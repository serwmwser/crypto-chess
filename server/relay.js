import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8081);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}
const WAITING_MATCH_TTL_MS = 48 * 60 * 60 * 1000;
const EXPIRED_MATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DATA_FILE =
  process.env.RELAY_DATA_FILE || path.join(process.cwd(), "data", "relay-rooms.json");
const httpServer = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("ok\n");
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found\n");
});
const wss = new WebSocketServer({ server: httpServer });
const rooms = new Map();
const matchmakingQueue = new Map();

function normalizeClockSeconds(value) {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 60 && seconds <= 86_400
    ? seconds
    : 300;
}

function createRoom(id, options, now) {
  const clockSeconds = normalizeClockSeconds(options.clockSeconds);
  const clockStartedAt = Number(options.clockStartedAt) || 0;
  const chainGame = clockStartedAt > 0;
  const elapsed = chainGame ? Math.max(0, now / 1000 - clockStartedAt) : 0;
  const playerId = String(options.playerId || "");
  const ownerId = String(options.ownerId || (options.isHost ? playerId : ""));
  return {
    id,
    clients: new Set(),
    chess: new Chess(),
    moves: [],
    kind: options.kind === "free" ? "free" : "token",
    ownerId,
    playerIds: options.playerIds || {
      w: options.color === "b" ? "" : playerId,
      b: options.color === "b" ? playerId : "",
    },
    status: options.status || (chainGame ? "active" : "waiting"),
    clockSeconds,
    clocks: { w: Math.max(0, clockSeconds - elapsed), b: clockSeconds },
    turn: "w",
    lastTickAt: now,
    started: chainGame,
    createdAt: Number(options.createdAt) || now,
    updatedAt: now,
    flaggedColor: null,
  };
}

function restoreRooms() {
  if (!existsSync(DATA_FILE)) return;
  try {
    const saved = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(saved)) throw new Error("Relay state must contain an array of rooms.");
    const now = Date.now();
    for (const item of saved) {
      if (!item || typeof item.id !== "string" || !Array.isArray(item.moves)) continue;
      try {
        const room = createRoom(item.id, {
          kind: item.kind,
          playerId: item.ownerId,
          ownerId: item.ownerId,
          playerIds: item.playerIds,
          status: item.status,
          clockSeconds: item.clockSeconds,
          clockStartedAt: 0,
          createdAt: item.createdAt,
        }, now);
        for (const move of item.moves) {
          room.chess.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || "q",
          });
        }
        room.moves = item.moves;
        room.clocks = item.clocks;
        room.turn = room.chess.turn();
        room.started = item.started === true;
        room.lastTickAt = now;
        room.updatedAt = Number(item.updatedAt) || now;
        room.flaggedColor = item.flaggedColor || null;
        room.status = item.status;
        if (room.started) {
          const elapsed = Math.max(0, (now - Number(item.lastTickAt || now)) / 1000);
          room.clocks[room.turn] = Math.max(0, room.clocks[room.turn] - elapsed);
          if (room.clocks[room.turn] <= 0) {
            room.flaggedColor = room.turn;
            room.status = "completed";
            room.started = false;
          }
        }
        if (room.status === "waiting" && now - room.createdAt >= WAITING_MATCH_TTL_MS) {
          room.status = "expired";
          room.started = false;
          room.updatedAt = now;
        }
        if (room.status !== "expired" || now - room.updatedAt < EXPIRED_MATCH_TTL_MS) {
          rooms.set(room.id, room);
        }
      } catch (error) {
        console.error(`Could not restore relay room ${item.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Could not load persisted relay rooms:", error);
  }
}

function persistRooms() {
  const saved = Array.from(rooms.values(), (room) => ({
    id: room.id,
    kind: room.kind,
    ownerId: room.ownerId,
    playerIds: room.playerIds,
    status: room.status,
    clockSeconds: room.clockSeconds,
    clocks: room.clocks,
    turn: room.turn,
    lastTickAt: room.lastTickAt,
    started: room.started,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    flaggedColor: room.flaggedColor,
    moves: room.moves,
  }));
  try {
    mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tempFile = `${DATA_FILE}.tmp`;
    writeFileSync(tempFile, JSON.stringify(saved));
    renameSync(tempFile, DATA_FILE);
  } catch (error) {
    console.error("Could not persist relay rooms:", error);
  }
}

function expireWaitingRooms(now = Date.now()) {
  let changed = false;
  for (const room of rooms.values()) {
    if (room.kind === "free" && room.status === "waiting" &&
        now - room.createdAt >= WAITING_MATCH_TTL_MS) {
      room.status = "expired";
      room.started = false;
      room.updatedAt = now;
      room.flaggedColor = null;
      for (const client of room.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "free-game-expired", id: room.id }));
        }
      }
      changed = true;
    }
  }
  for (const [id, room] of rooms) {
    if (room.status === "expired" && now - room.updatedAt >= EXPIRED_MATCH_TTL_MS) {
      rooms.delete(id);
      changed = true;
    }
  }
  if (changed) persistRooms();
}

function snapshot(room, now = Date.now()) {
  const clocks = { ...room.clocks };
  if (room.started) {
    clocks[room.turn] = Math.max(0, clocks[room.turn] - (now - room.lastTickAt) / 1000);
    if (clocks[room.turn] === 0) {
      room.clocks = clocks;
      room.flaggedColor = room.turn;
      room.started = false;
      room.status = "completed";
      room.updatedAt = now;
      room.lastTickAt = now;
      persistRooms();
    }
  }
  return {
    moves: room.moves,
    clocks,
    turn: room.turn,
    started: room.started,
    tickAt: now,
    status: room.status,
    flaggedColor: room.flaggedColor,
    playerCount: Object.values(room.playerIds).filter(Boolean).length,
  };
}

function broadcast(room, message) {
  const payload = JSON.stringify(message);
  for (const client of room.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function sendState(ws, room) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "state", state: snapshot(room) }));
  }
}

function connectedPlayerCount(room) {
  return new Set(Array.from(room.clients, (client) => client.playerId)).size;
}

function sendPresence(room) {
  broadcast(room, {
    type: "presence",
    online: connectedPlayerCount(room) > 1,
  });
}

function freeGameList(playerId) {
  expireWaitingRooms();
  const playerRooms = Array.from(rooms.values()).filter(
    (room) => room.kind === "free" &&
      (room.ownerId === playerId ||
       room.playerIds.w === playerId ||
       room.playerIds.b === playerId)
  );
  const removedIds = playerRooms
    .filter((room) => room.status === "expired" || room.status === "deleted")
    .map((room) => room.id);
  const games = playerRooms
    .filter((room) =>
      room.status === "waiting" || room.status === "active" || room.status === "completed"
    )
    .map((room) => ({
      id: room.id,
      status: room.status,
      clockSeconds: room.clockSeconds,
      createdAt: room.createdAt,
      expiresAt: room.status === "waiting" ? room.createdAt + WAITING_MATCH_TTL_MS : null,
      playerCount: Object.values(room.playerIds).filter(Boolean).length,
      isOwner: room.ownerId === playerId,
    }));
  return { games, removedIds };
}

function sendFreeGameList(ws, playerId) {
  ws.send(JSON.stringify({ type: "free-games", ...freeGameList(playerId) }));
}

function updateQueueStatus() {
  const counts = new Map();
  for (const item of matchmakingQueue.values()) {
    counts.set(item.clockSeconds, (counts.get(item.clockSeconds) || 0) + 1);
  }
  for (const item of matchmakingQueue.values()) {
    if (item.ws.readyState === 1) {
      item.ws.send(JSON.stringify({
        type: "queue-status",
        waitingPlayers: Math.max(0, counts.get(item.clockSeconds) - 1),
      }));
    }
  }
}

function sendError(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type: "relay-error", message }));
}

function joinRoom(ws, message) {
  const id = String(message.id || "");
  const playerId = String(message.playerId || "");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(playerId)) {
    sendError(ws, "Invalid match or player ID.");
    return;
  }

  if (ws.room && rooms.has(ws.room)) rooms.get(ws.room).clients.delete(ws);
  let room = rooms.get(id);
  if (!room && message.kind === "free" && message.isHost === true) {
    room = createRoom(id, {
      ...message,
      kind: "free",
      playerId,
      ownerId: playerId,
      playerIds: { w: playerId, b: "" },
      status: "waiting",
    }, Date.now());
    rooms.set(id, room);
  } else if (!room && message.kind !== "free") {
    room = createRoom(id, message, Date.now());
    rooms.set(id, room);
  }
  if (!room || room.kind === "free" && room.status === "expired") {
    ws.send(JSON.stringify({ type: "free-game-expired", id }));
    return;
  }
  if (room.kind === "free" && room.status === "deleted") {
    ws.send(JSON.stringify({ type: "free-game-deleted", id }));
    return;
  }

  let matchStarted = false;
  let color = room.playerIds.w === playerId ? "w" :
    room.playerIds.b === playerId ? "b" : null;
  if (!color) {
    if (room.kind === "token" &&
        (message.color === "w" || message.color === "b") &&
        !room.playerIds[message.color]) {
      color = message.color;
      room.playerIds[color] = playerId;
    } else if (room.kind === "free" && message.isHost !== true &&
        room.status === "waiting" && !room.playerIds.b) {
      color = "b";
      room.playerIds.b = playerId;
      room.status = "active";
      room.started = true;
      room.lastTickAt = Date.now();
      room.updatedAt = Date.now();
      matchStarted = true;
    } else {
      sendError(ws, "This match already has two players or is no longer waiting.");
      return;
    }
  }

  if (room.kind === "free" && message.isHost === true) {
    if (room.ownerId && room.ownerId !== playerId) {
      sendError(ws, "Only the match creator can reopen this side.");
      return;
    }
    room.ownerId = playerId;
  }
  if (!room.playerIds[color]) room.playerIds[color] = playerId;

  const existingClient = Array.from(room.clients).find(
    (client) => client.playerId === playerId
  );
  if (existingClient) {
    room.clients.delete(existingClient);
    existingClient.close();
  }
  room.clients.add(ws);
  ws.room = id;
  ws.playerId = playerId;
  ws.playerColor = color;
  room.updatedAt = Date.now();
  sendPresence(room);
  if (matchStarted) {
    broadcast(room, { type: "state", state: snapshot(room) });
  } else {
    sendState(ws, room);
  }
  if (room.kind === "free") persistRooms();
}

function enqueueMatchmaking(ws, message) {
  const playerId = String(message.playerId || "");
  const clockSeconds = normalizeClockSeconds(message.clockSeconds);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(playerId)) {
    sendError(ws, "Invalid player ID.");
    return;
  }
  ws.playerId = playerId;
  matchmakingQueue.delete(playerId);
  const candidate = Array.from(matchmakingQueue.values()).find(
    (item) => item.playerId !== playerId &&
      item.clockSeconds === clockSeconds &&
      item.ws.readyState === 1
  );
  if (!candidate) {
    matchmakingQueue.set(playerId, { playerId, clockSeconds, ws });
    updateQueueStatus();
    return;
  }

  matchmakingQueue.delete(candidate.playerId);
  const id = `auto-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const room = createRoom(id, {
    kind: "free",
    ownerId: candidate.playerId,
    playerId: candidate.playerId,
    playerIds: { w: candidate.playerId, b: playerId },
    status: "active",
    clockSeconds,
  }, now);
  room.status = "active";
  room.started = true;
  room.lastTickAt = now;
  room.updatedAt = now;
  rooms.set(id, room);
  persistRooms();

  for (const [client, isHost] of [[candidate.ws, true], [ws, false]]) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: "match-found",
        id,
        isHost,
        clockSeconds,
      }));
    }
  }
  updateQueueStatus();
}

function handleMessage(ws, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  if (message.type === "find-match") {
    enqueueMatchmaking(ws, message);
    return;
  }
  if (message.type === "cancel-match-search") {
    if (ws.playerId) matchmakingQueue.delete(ws.playerId);
    updateQueueStatus();
    return;
  }
  if (message.type === "list-free-games") {
    const playerId = String(message.playerId || "");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(playerId)) {
      sendError(ws, "Invalid player ID.");
      return;
    }
    sendFreeGameList(ws, playerId);
    return;
  }
  if (message.type === "join") {
    joinRoom(ws, message);
    return;
  }
  if (message.type === "delete-free-game") {
    const room = rooms.get(String(message.id || ""));
    if (!room || room.kind !== "free" || room.ownerId !== message.playerId ||
        room.status !== "waiting" || room.moves.length > 0) {
      sendError(ws, "Only the creator can delete a waiting match.");
      return;
    }
    room.status = "deleted";
    broadcast(room, { type: "free-game-deleted", id: room.id });
    rooms.delete(room.id);
    persistRooms();
    ws.send(JSON.stringify({ type: "free-game-deleted", id: room.id }));
    return;
  }
  if (message.type !== "relay" || message.msg?.type !== "move") return;
  const room = rooms.get(String(message.id || ""));
  if (!room || !room.clients.has(ws)) return;

  const now = Date.now();
  const state = snapshot(room, now);
  if (!state.started || state.clocks[room.chess.turn()] <= 0) {
    sendError(ws, "The active player's time has expired.");
    broadcast(room, { type: "state", state });
    return;
  }
  const expectedPlayer = room.playerIds[room.chess.turn()];
  if (expectedPlayer && ws.playerId !== expectedPlayer) {
    sendError(ws, "It is not your turn.");
    sendState(ws, room);
    return;
  }

  try {
    const move = room.chess.move({
      from: message.msg.from,
      to: message.msg.to,
      promotion: message.msg.promotion || "q",
    });
    if (!move) {
      sendState(ws, room);
      return;
    }
    room.moves = room.chess.history({ verbose: true }).map((played) => ({
      from: played.from,
      to: played.to,
      promotion: played.promotion || "q",
    }));
    room.clocks = state.clocks;
    room.turn = room.chess.turn();
    room.lastTickAt = now;
    room.started = !room.chess.isGameOver();
    room.status = room.started ? "active" : "completed";
    room.updatedAt = now;
    persistRooms();
    broadcast(room, { type: "state", state: snapshot(room, now) });
  } catch (error) {
    sendError(ws, error.message || "Invalid move.");
    sendState(ws, room);
  }
}

restoreRooms();

wss.on("connection", (ws) => {
  ws.room = null;
  ws.playerId = null;
  ws.on("message", (raw) => handleMessage(ws, raw));
  ws.on("error", (error) => {
    console.error("Relay WebSocket error:", error);
  });
  ws.on("close", () => {
    if (ws.playerId && matchmakingQueue.get(ws.playerId)?.ws === ws) {
      matchmakingQueue.delete(ws.playerId);
      updateQueueStatus();
    }
    if (!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    room.clients.delete(ws);
    room.updatedAt = Date.now();
    sendPresence(room);
  });
});

setInterval(() => {
  expireWaitingRooms();
  for (const room of rooms.values()) {
    if (room.started && room.clients.size) {
      const state = snapshot(room);
      broadcast(room, { type: state.started ? "clock" : "state", state });
    }
  }
}, 1000).unref();

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Chess relay listening on port ${PORT}`);
});
