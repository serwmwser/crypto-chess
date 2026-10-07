const STORAGE_KEY = "crypto-chess-free-games-v1";
const PLAYER_ID_KEY = "crypto-chess-free-player-id-v1";
const WAITING_MATCH_TTL_MS = 48 * 60 * 60 * 1000;

export function getFreePlayerId() {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch (error) {
    console.error("Could not access free match player ID:", error);
    return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function readFreeGames() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    const validGames = saved.filter(
      (game) =>
        game &&
        typeof game.roomId === "string" &&
        /^[a-zA-Z0-9-]{8,80}$/.test(game.roomId) &&
        (game.mode === "bot" || game.mode === "online")
    );
    const now = Date.now();
    const games = validGames.filter((game) => {
      const createdAt = Number(game.createdAt || game.updatedAt);
      return !(
        game.mode === "online" &&
        game.isHost &&
        game.status !== "active" &&
        Number.isFinite(createdAt) &&
        now - createdAt >= WAITING_MATCH_TTL_MS
      );
    });
    if (games.length !== saved.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    }
    return games;
  } catch (error) {
    console.error("Could not read saved free matches:", error);
    return [];
  }
}

export function saveFreeGame(game) {
  const games = readFreeGames();
  const previous = games.find((item) => item.roomId === game.roomId);
  const createdAt = previous?.createdAt || previous?.updatedAt || Date.now();
  const saved = {
    roomId: game.roomId,
    mode: game.mode,
    minutes: game.minutes,
    isHost: game.isHost,
    status: game.status || (game.isHost ? "waiting" : "joining"),
    createdAt,
    updatedAt: Date.now(),
  };
  const nextGames = [saved, ...games.filter((item) => item.roomId !== game.roomId)].slice(0, 30);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGames));
  } catch (error) {
    console.error("Could not save free match:", error);
  }
  return nextGames;
}

export function removeFreeGame(roomId) {
  const nextGames = readFreeGames().filter((game) => game.roomId !== roomId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGames));
  } catch (error) {
    console.error("Could not remove saved free match:", error);
  }
  return nextGames;
}
