import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import { FREE_TIME_CONTROLS, RELAY_URL } from "../lib/config";
import { getFreePlayerId } from "../lib/freeGames";
import { GamePlayback, VictoryCelebration } from "./GamePlayback";
import InviteCard from "./InviteCard";

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const BOT_MOVE_DELAYS = [1, 2, 3, 4, 2, 1, 2];

export default function FreeGameRoom({ mode, roomId, isHost, minutes = 5, onExit, onDelete, notify }) {
  const { t } = useTranslation();
  const callbacksRef = useRef({ onExit, onDelete });
  callbacksRef.current = { onExit, onDelete };
  const chess = useRef(new Chess()).current;
  const wsRef = useRef(null);
  const [fen, setFen] = useState(chess.fen());
  const [remaining, setRemaining] = useState({ w: minutes * 60, b: minutes * 60 });
  const remainingRef = useRef({ w: minutes * 60, b: minutes * 60 });
  const clockTurnRef = useRef("w");
  const clockLastTickRef = useRef(Date.now());
  const [clockRunning, setClockRunning] = useState(mode === "bot");
  const [flaggedColor, setFlaggedColor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [moves, setMoves] = useState([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const movesRef = useRef([]);
  const moveIndexRef = useRef(0);
  const botMoveCountRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [relayUnavailable, setRelayUnavailable] = useState(!RELAY_URL);
  const [opponentConnected, setOpponentConnected] = useState(mode === "bot");
  const [matchStatus, setMatchStatus] = useState(
    mode === "bot" ? "active" : isHost ? "waiting" : "joining"
  );
  const myColor = mode === "bot" || isHost ? "w" : "b";
  const isOver = chess.isGameOver() || flaggedColor !== null;
  const showClock = true;

  function syncMoveHistory() {
    const nextMoves = chess.history({ verbose: true });
    const followLatest = moveIndexRef.current === movesRef.current.length;
    movesRef.current = nextMoves;
    setMoves(nextMoves);
    if (followLatest) {
      moveIndexRef.current = nextMoves.length;
      setMoveIndex(nextMoves.length);
    }
  }

  function selectMoveIndex(index) {
    moveIndexRef.current = index;
    setMoveIndex(index);
  }

  function restoreMoveHistory(history) {
    if (!Array.isArray(history) || chess.history().length > 0) return;
    try {
      for (const move of history) {
        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q",
        });
      }
      syncMoveHistory();
      setFen(chess.fen());
    } catch (error) {
      chess.reset();
      syncMoveHistory();
      setFen(chess.fen());
      console.error("Could not restore game move history:", error);
    }
  }

  function applyRelayState(state) {
    if (!Array.isArray(state?.moves)) return;
    try {
      chess.reset();
      for (const move of state.moves) {
        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q",
        });
      }
      syncMoveHistory();
      setFen(chess.fen());
      setSelected(null);
      setTargets([]);
      if (state.clocks && Number.isFinite(state.clocks.w) && Number.isFinite(state.clocks.b)) {
        const nextRemaining = {
          w: Math.max(0, state.clocks.w),
          b: Math.max(0, state.clocks.b),
        };
        remainingRef.current = nextRemaining;
        setRemaining(nextRemaining);
        clockTurnRef.current = state.turn === "b" ? "b" : "w";
        clockLastTickRef.current = Date.now();
        setFlaggedColor(
          state.started || nextRemaining[clockTurnRef.current] > 0
            ? null
            : clockTurnRef.current
        );
      }
      setClockRunning(state.started === true);
      setMatchStatus(state.status || "active");
      setOpponentConnected(state.playerCount >= 2);
    } catch (error) {
      console.error("Could not apply authoritative match state:", error);
      notify?.(error.message || String(error));
    }
  }

  function applyRelayClock(state) {
    if (!state?.clocks || !Number.isFinite(state.clocks.w) || !Number.isFinite(state.clocks.b)) {
      return;
    }
    const nextRemaining = {
      w: Math.max(0, state.clocks.w),
      b: Math.max(0, state.clocks.b),
    };
    remainingRef.current = nextRemaining;
    setRemaining(nextRemaining);
    clockTurnRef.current = state.turn === "b" ? "b" : "w";
    clockLastTickRef.current = Date.now();
    setClockRunning(state.started === true);
    setMatchStatus(state.status || "active");
    setFlaggedColor(
      state.flaggedColor === "w" || state.flaggedColor === "b"
        ? state.flaggedColor
        : null
    );
  }

  function chargeActiveClock() {
    if (!showClock || !clockRunning || remainingRef.current[clockTurnRef.current] <= 0) return false;

    const now = Date.now();
    const color = clockTurnRef.current;
    const nextTime = Math.max(
      0,
      remainingRef.current[color] - (now - clockLastTickRef.current) / 1000
    );
    remainingRef.current = { ...remainingRef.current, [color]: nextTime };
    clockLastTickRef.current = now;
    setRemaining(remainingRef.current);
    if (nextTime === 0) {
      setFlaggedColor(color);
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (!showClock || !clockRunning || isOver) return undefined;
    const timer = window.setInterval(() => {
      chargeActiveClock();
    }, 250);

    return () => window.clearInterval(timer);
  }, [chess, isOver, showClock, clockRunning]);

  useEffect(() => {
    if (mode !== "online") return undefined;
    if (!RELAY_URL) {
      setConnected(false);
      setRelayUnavailable(true);
      return undefined;
    }

    let alive = true;
    let ws;
    setRelayUnavailable(false);
    try {
      ws = new WebSocket(RELAY_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!alive) return;
        setConnected(true);
        setRelayUnavailable(false);
        ws.send(JSON.stringify({
          type: "join",
          id: roomId,
          kind: "free",
          playerId: getFreePlayerId(),
          isHost,
          clockSeconds: minutes * 60,
        }));
      };
      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        setRelayUnavailable(true);
      };
      ws.onerror = () => {
        if (!alive) return;
        setConnected(false);
        setRelayUnavailable(true);
      };
      ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "presence") {
          setOpponentConnected(message.online);
          return;
        }
        if (message.type === "state") {
          applyRelayState(message.state);
          return;
        }
        if (message.type === "clock") {
          applyRelayClock(message.state);
          return;
        }
        if (message.type === "free-game-expired") {
          setMatchStatus("expired");
          setClockRunning(false);
          notify?.(t("freeMatchExpired"));
          callbacksRef.current.onDelete?.(roomId);
          callbacksRef.current.onExit();
          return;
        }
        if (message.type === "free-game-deleted") {
          callbacksRef.current.onDelete?.(roomId);
          callbacksRef.current.onExit();
          return;
        }
        if (message.type === "history") restoreMoveHistory(message.moves);
        if (message.type === "relay-error") notify?.(message.message);
        if (message.type !== "relay" || message.msg?.type !== "move") return;
        if (chess.isGameOver() || chess.turn() === myColor) return;
        try {
          const move = chess.move({
            from: message.msg.from,
            to: message.msg.to,
            promotion: message.msg.promotion || "q",
          });
          if (move) {
            syncMoveHistory();
            setFen(chess.fen());
            setSelected(null);
            setTargets([]);
          }
        } catch (error) {
          console.error("Rejected invalid opponent move:", error);
        }
      };
    } catch (error) {
      console.error("Could not connect to the game relay:", error);
      setConnected(false);
      setRelayUnavailable(true);
    }
    return () => {
      alive = false;
      ws?.close();
      wsRef.current = null;
    };
  }, [mode, roomId, myColor, chess, minutes, isHost, notify, t]);

  useEffect(() => {
    if (mode !== "bot" || chess.turn() !== "b" || chess.isGameOver()) return undefined;
    const delay = BOT_MOVE_DELAYS[botMoveCountRef.current % BOT_MOVE_DELAYS.length];
    const timer = window.setTimeout(() => {
      try {
        if (!chargeActiveClock()) return;
        const moves = chess.moves({ verbose: true });
        let bestScore = -Infinity;
        let candidates = [];
        for (const move of moves) {
          const candidateGame = new Chess(fen);
          candidateGame.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || "q",
          });
          const score =
            (move.captured ? PIECE_VALUE[move.captured] * 2 : 0) +
            (move.promotion ? PIECE_VALUE[move.promotion] : 0) +
            (candidateGame.isCheck() ? 0.5 : 0) +
            Math.random() * 0.35;
          if (score > bestScore) {
            bestScore = score;
            candidates = [move];
          } else if (score === bestScore) {
            candidates.push(move);
          }
        }
        const move = candidates[Math.floor(Math.random() * candidates.length)];
        if (move) {
          chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
          botMoveCountRef.current += 1;
          clockTurnRef.current = chess.turn();
          clockLastTickRef.current = Date.now();
          setClockRunning(true);
          syncMoveHistory();
          setFen(chess.fen());
        }
      } catch (error) {
        notify?.(error.message || String(error));
      }
    }, delay * 1000);
    return () => window.clearTimeout(timer);
  }, [mode, fen, chess]);

  function formatClock(seconds) {
    const wholeSeconds = Math.ceil(seconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainder = wholeSeconds % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
      : `${Math.floor(wholeSeconds / 60)}:${String(remainder).padStart(2, "0")}`;
  }

  function deleteWaitingGame() {
    if (!isHost || mode !== "online" || matchStatus !== "waiting") return;
    if (!window.confirm(t("confirmDeleteFreeGame"))) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      callbacksRef.current.onDelete?.(roomId);
      notify?.(t("freeGameRemovedLocally"));
      callbacksRef.current.onExit();
      return;
    }
    wsRef.current.send(JSON.stringify({
      type: "delete-free-game",
      id: roomId,
      playerId: getFreePlayerId(),
    }));
  }

  function handleSquare(square) {
    if (
      isOver ||
      moveIndexRef.current < movesRef.current.length ||
      chess.turn() !== myColor ||
      (mode === "online" && (!connected || !opponentConnected))
    ) return;
    const piece = chess.get(square);
    if (selected && targets.includes(square)) {
      try {
        if (!chargeActiveClock()) return;
        const move = chess.move({ from: selected, to: square, promotion: "q" });
        if (move) {
          syncMoveHistory();
          clockTurnRef.current = chess.turn();
          clockLastTickRef.current = Date.now();
          setFen(chess.fen());
          setSelected(null);
          setTargets([]);
          if (mode === "online" && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "relay",
                id: roomId,
                msg: { type: "move", from: move.from, to: move.to, promotion: move.promotion },
              })
            );
          }
        }
      } catch (error) {
        notify?.(error.message || String(error));
      }
      return;
    }
    if (piece?.color === myColor) {
      setSelected(square);
      setTargets(chess.moves({ square, verbose: true }).map((move) => move.to));
    } else {
      setSelected(null);
      setTargets([]);
    }
  }

  const result = flaggedColor
    ? chess.isInsufficientMaterial()
      ? t("freeTimeoutDraw")
      : flaggedColor === myColor
        ? t("freeTimeoutLoss")
        : t("freeTimeoutWin")
    : isOver
    ? chess.isCheckmate()
      ? chess.turn() === myColor
        ? t("freeLoss")
        : t("freeWin")
      : t("freeDraw")
    : null;
  const winnerColor = flaggedColor
    ? chess.isInsufficientMaterial()
      ? null
      : flaggedColor === "w" ? "b" : "w"
    : chess.isCheckmate()
      ? chess.turn() === "w" ? "b" : "w"
      : null;
  const winnerName = winnerColor
    ? `${winnerColor === "b" && mode === "bot"
      ? t("botOpponent")
      : t(winnerColor === "w" ? "white" : "black")}${winnerColor === myColor ? ` · ${t("you")}` : ""}`
    : null;
  const inviteUrlObject = new URL(window.location.href);
  inviteUrlObject.search = "";
  inviteUrlObject.searchParams.set("free", roomId);
  inviteUrlObject.searchParams.set("freeMode", mode);
  inviteUrlObject.searchParams.set("freeHost", "0");
  inviteUrlObject.searchParams.set("freeMinutes", String(minutes));
  const inviteUrl = inviteUrlObject.toString();
  const inviteText = `${t("freeInviteMessage")} ${inviteUrl}`;

  return (
    <div className="page room">
      <button className="btn btn-ghost" onClick={onExit}>{t("back")}</button>
      <div className="room-layout">
        <div className="card room-card">
          <div className="kv">
            <span>{t("freeGameLabel")}</span>
            <span>
              {mode === "bot"
                ? `${t("botOpponent")} · ${t(FREE_TIME_CONTROLS.find((control) => control.value === minutes)?.key || "t5")}`
                : `${t("opponentPlayer")} · ${t(matchStatus === "waiting" ? "freeMatchWaiting" : matchStatus === "expired" ? "freeMatchExpired" : matchStatus === "active" ? "inProgress" : "waitingForOpponent")}`}
            </span>
          </div>
          <div className="players">
            <div className={`player ${chess.turn() === "w" && !isOver ? "player-active" : ""}`}>
              <b>{t("white")} {myColor === "w" && `· ${t("you")}`}</b>
              <span className={`clock ${remaining.w <= 0 ? "clock-out" : ""}`}>
                {formatClock(remaining.w)}
              </span>
            </div>
            <div className={`player ${chess.turn() === "b" && !isOver ? "player-active" : ""}`}>
              <b>{mode === "bot" ? t("botOpponent") : t("black")} {myColor === "b" && `· ${t("you")}`}</b>
              <span className={`clock ${remaining.b <= 0 ? "clock-out" : ""}`}>
                {formatClock(remaining.b)}
              </span>
            </div>
          </div>
          <div className={`turn-pill ${chess.turn() === myColor ? "you" : "opp"}`}>
            {matchStatus === "expired"
              ? t("freeMatchExpired")
              : matchStatus === "deleted"
                ? t("freeMatchDeleted")
                : isOver
              ? t("ended")
              : mode === "online" && !opponentConnected
                ? t("waitingForOpponent")
                : chess.turn() === myColor
                  ? t("yourTurn")
                  : t("opponentTurn")}
          </div>
          <GamePlayback
            board={chess.board()}
            myColor={myColor}
            selected={selected}
            targets={targets}
            onSquare={handleSquare}
            disabled={
              isOver ||
              chess.turn() !== myColor ||
              (mode === "online" && (!connected || !opponentConnected))
            }
            moves={moves}
            moveIndex={moveIndex}
            onMoveIndexChange={selectMoveIndex}
          />
          {mode === "online" && (
            <p className="muted small">
              {relayUnavailable
                ? t("relayUnavailable")
                : !connected
                  ? t("relayConnecting")
                  : opponentConnected
                    ? t("relayConnected")
                    : t("waitingForOpponent")}
            </p>
          )}
          {result && <div className="result">{result}</div>}
          {mode === "online" && isHost && !isOver && matchStatus === "waiting" && (
            <>
              {matchStatus === "waiting" && (
                <button className="btn btn-danger btn-sm" onClick={deleteWaitingGame}>
                  {t("deleteFreeGame")}
                </button>
              )}
              <InviteCard
                title={t("freeInviteTitle")}
                note={t("freeInviteNote")}
                url={inviteUrl}
                text={inviteText}
              />
            </>
          )}
        </div>
      </div>
      <VictoryCelebration winner={winnerName} />
    </div>
  );
}