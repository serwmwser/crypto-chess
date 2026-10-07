import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import { getEscrow, getEscrowView, parseGame, shortAddr, formatStake, ZERO_ADDR } from "../lib/contracts";
import { RELAY_URL } from "../lib/config";
import { getFreePlayerId } from "../lib/freeGames";
import { GamePlayback, VictoryCelebration } from "./GamePlayback";
import InviteCard from "./InviteCard";

const fmtTime = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export default function GameRoom({ signer, provider, address, gameId, decimals, onExit, notify }) {
  const { t } = useTranslation();
  const chess = useRef(new Chess()).current;
  const [game, setGame] = useState(null);
  const [status, setStatus] = useState(1);
  const [winner, setWinner] = useState(null);
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [moves, setMoves] = useState([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const movesRef = useRef([]);
  const moveIndexRef = useRef(0);
  const [fen, setFen] = useState(chess.fen());
  const [times, setTimes] = useState({ w: 0, b: 0 });
  const timesRef = useRef({ w: 0, b: 0 });
  const clockTurnRef = useRef("w");
  const clockLastTickRef = useRef(Date.now());
  const clockInitializedRef = useRef(false);
  const [clockRunning, setClockRunning] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);
  const [relayUnavailable, setRelayUnavailable] = useState(!RELAY_URL);
  const [banner, setBanner] = useState(null); // {kind: 'timeout-mine'|'timeout-theirs'|'mate'|'stale'}
  const [myColor, setMyColor] = useState("w");
  const [drawWait, setDrawWait] = useState(false);
  const wsRef = useRef(null);

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
      if (state.flaggedColor === "w" || state.flaggedColor === "b") {
        setBanner(state.flaggedColor === myColor ? "timeout-mine" : "timeout-theirs");
      } else if (chess.isCheckmate()) {
        setBanner("mate");
      } else if (chess.isStalemate()) {
        setBanner("stale");
      } else {
        setBanner(null);
      }
      syncMoveHistory();
      setFen(chess.fen());
      setSelected(null);
      setTargets([]);
      if (state.clocks && Number.isFinite(state.clocks.w) && Number.isFinite(state.clocks.b)) {
        const nextTimes = {
          w: Math.max(0, state.clocks.w),
          b: Math.max(0, state.clocks.b),
        };
        timesRef.current = nextTimes;
        setTimes(nextTimes);
        clockTurnRef.current = state.turn === "b" ? "b" : "w";
        clockLastTickRef.current = Date.now();
        clockInitializedRef.current = true;
        if (nextTimes[clockTurnRef.current] <= 0) {
          setBanner(clockTurnRef.current === myColor ? "timeout-mine" : "timeout-theirs");
        }
      }
      setClockRunning(state.started === true);
    } catch (error) {
      console.error("Could not apply authoritative match state:", error);
      notify?.(error.message || String(error));
    }
  }

  function applyRelayClock(state) {
    if (!state?.clocks || !Number.isFinite(state.clocks.w) || !Number.isFinite(state.clocks.b)) {
      return;
    }
    const nextTimes = {
      w: Math.max(0, state.clocks.w),
      b: Math.max(0, state.clocks.b),
    };
    timesRef.current = nextTimes;
    setTimes(nextTimes);
    clockTurnRef.current = state.turn === "b" ? "b" : "w";
    clockLastTickRef.current = Date.now();
    setClockRunning(state.started === true);
    if (state.flaggedColor === myColor) setBanner("timeout-mine");
    else if (state.flaggedColor === "w" || state.flaggedColor === "b") {
      setBanner("timeout-theirs");
    }
  }

  function chargeActiveClock() {
    if (!clockRunning || status !== 1 || chess.isGameOver()) return false;
    const now = Date.now();
    const color = clockTurnRef.current;
    const remaining = Math.max(
      0,
      timesRef.current[color] - (now - clockLastTickRef.current) / 1000
    );
    const nextTimes = { ...timesRef.current, [color]: remaining };
    timesRef.current = nextTimes;
    clockLastTickRef.current = now;
    setTimes(nextTimes);
    if (remaining === 0) {
      setBanner(color === myColor ? "timeout-mine" : "timeout-theirs");
      setClockRunning(false);
      return false;
    }
    return true;
  }

  // Загрузка данных матча + опрос статуса (операции эскроу видны в ончейн)
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const g = parseGame(await getEscrowView(provider).getGame(gameId));
        if (!alive) return;
        setGame(g);
        setStatus(g.status);
        setWinner(g.winner);
        const me = address ? address.toLowerCase() : "";
        setMyColor(g.creator.toLowerCase() === me ? "w" : "b");
        if (!clockInitializedRef.current && g.status === 1) {
          const elapsed = g.startedAt
            ? Math.max(0, Date.now() / 1000 - g.startedAt)
            : 0;
          const initialTimes = {
            w: Math.max(0, g.duration - elapsed),
            b: g.duration,
          };
          timesRef.current = initialTimes;
          setTimes(initialTimes);
          clockTurnRef.current = "w";
          clockLastTickRef.current = Date.now();
          clockInitializedRef.current = true;
          setClockRunning(true);
        }
        setDrawWait(g.creatorDraw && g.challengerDraw);
        // События по времени/мату
        if (statusRef.current === 1) {
          if (chess.isCheckmate()) setBanner("mate");
          else if (chess.isStalemate()) setBanner("stale");
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
    const iv = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [gameId, address]);

  const statusRef = useRef(status);
  statusRef.current = status;

  // Локальные часы остаются smooth между синхронизациями с relay.
  useEffect(() => {
    if (!game || status !== 1 || !clockRunning) return;
    const iv = setInterval(() => {
      chargeActiveClock();
    }, 250);
    return () => clearInterval(iv);
  }, [game, status, clockRunning]);

  // Баннер по истечению времени
  useEffect(() => {
    if (!game || status !== 1) return;
    if (times[myColor] <= 0) setBanner("timeout-mine");
    else if (times[myColor === "w" ? "b" : "w"] <= 0) setBanner("timeout-theirs");
  }, [times, myColor, game, status]);

  // Relay: синхронизация ходов с соперником
  useEffect(() => {
    if (!game || status !== 1) return;
    if (!RELAY_URL) {
      setRelayConnected(false);
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
        setRelayConnected(true);
        setRelayUnavailable(false);
        ws.send(JSON.stringify({
          type: "join",
          id: gameId,
          kind: "token",
          playerId: getFreePlayerId(),
          color: myColor,
          clockSeconds: game.duration,
          clockStartedAt: game.startedAt,
        }));
      };
      ws.onclose = () => {
        if (!alive) return;
        setRelayConnected(false);
        setRelayUnavailable(true);
      };
      ws.onerror = () => {
        if (!alive) return;
        setRelayConnected(false);
        setRelayUnavailable(true);
      };
      ws.onmessage = (ev) => {
        if (!alive) return;
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "state") {
          applyRelayState(msg.state);
          return;
        }
        if (msg.type === "clock") {
          applyRelayClock(msg.state);
          return;
        }
        if (msg.type === "history") restoreMoveHistory(msg.moves);
        if (msg.type === "relay-error") notify?.(msg.message);
        if (msg.type === "relay" && msg.msg?.type === "move") {
          try {
            const mv = chess.move({ from: msg.msg.from, to: msg.msg.to, promotion: "q" });
            if (mv) {
              timesRef.current = {
                ...timesRef.current,
                [clockTurnRef.current]: Math.max(
                  0,
                  timesRef.current[clockTurnRef.current] -
                    (Date.now() - clockLastTickRef.current) / 1000
                ),
              };
              clockTurnRef.current = chess.turn();
              clockLastTickRef.current = Date.now();
              setTimes(timesRef.current);
              syncMoveHistory();
              setFen(chess.fen());
              setSelected(null);
              setTargets([]);
            }
          } catch {}
        }
      };
    } catch {
      setRelayConnected(false);
      setRelayUnavailable(true);
    }
    return () => {
      alive = false;
      try {
        ws && ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [Boolean(game), game?.duration, game?.startedAt, status, gameId, myColor]);

  function handleSquare(square) {
    if (
      !game ||
      status !== 1 ||
      isOver ||
      moveIndexRef.current < movesRef.current.length
    ) return;
    if (chess.turn() !== myColor) return;
    const piece = chess.get(square);
    if (selected) {
      if (targets.includes(square)) {
        try {
          if (!chargeActiveClock()) return;
          const mv = chess.move({ from: selected, to: square, promotion: "q" });
          if (mv) {
            clockTurnRef.current = chess.turn();
            clockLastTickRef.current = Date.now();
            syncMoveHistory();
            setFen(chess.fen());
            setSelected(null);
            setTargets([]);
            wsRef.current?.send(
              JSON.stringify({
                type: "relay",
                id: gameId,
                msg: { type: "move", from: selected, to: square },
              })
            );
          }
        } catch {}
        return;
      }
      setSelected(null);
      setTargets([]);
    }
    if (piece && piece.color === myColor) {
      setSelected(square);
      setTargets(chess.moves({ square, verbose: true }).map((m) => m.to));
    }
  }

  async function resign() {
    if (!signer || status !== 1) return;
    notify(t("sendingTx"));
    try {
      const tx = await getEscrow(signer).resign(gameId);
      notify(t("txSent"));
      await tx.wait();
    } catch (e) {
      notify(e.shortMessage || e.message || String(e));
    }
  }

  async function agreeDraw() {
    if (!signer || status !== 1 || (myColor === "w" ? game?.creatorDraw : game?.challengerDraw))
      return;
    notify(t("sendingTx"));
    try {
      const tx = await getEscrow(signer).agreeDraw(gameId);
      notify(t("txSent"));
      await tx.wait();
      setDrawWait(true);
    } catch (e) {
      notify(e.shortMessage || e.message || String(e));
    }
  }

  const iAmCreator = game ? game.creator.toLowerCase() === address?.toLowerCase() : true;
  const isOver = status !== 1 || chess.isGameOver() ||
    banner === "timeout-mine" || banner === "timeout-theirs";

  let resultText = null;
  let winnerName = null;
  if (game) {
    let winnerColor = null;
    if (winner && winner !== ZERO_ADDR) {
      winnerColor = winner.toLowerCase() === game.creator.toLowerCase() ? "w" : "b";
    } else if (chess.isCheckmate()) {
      winnerColor = chess.turn() === "w" ? "b" : "w";
    } else if (banner === "timeout-mine" || banner === "timeout-theirs") {
      winnerColor = banner === "timeout-mine"
        ? myColor === "w" ? "b" : "w"
        : myColor;
    }

    if (status === 3 || chess.isStalemate()) {
      resultText = t("drawResult");
    } else if (winnerColor) {
      const winnerAddress = winnerColor === "w" ? game.creator : game.challenger;
      resultText =
        winnerAddress?.toLowerCase() === address?.toLowerCase() ? t("win") : t("lose");
      winnerName = `${winnerColor === "w" ? t("white") : t("black")}${
        winnerAddress?.toLowerCase() === address?.toLowerCase() ? ` · ${t("you")}` : ""
      }`;
    } else if (status !== 1) {
      resultText = t("cancelled");
    }
  }

  const clockOf = (color) =>
    ({
      name: color === "w" ? t("white") : t("black"),
      addr: color === "w" ? game?.creator : game?.challenger,
      you: color === myColor,
      time: times[color] || 0,
      active: status === 1 && !isOver && chess.turn() === color,
    });

  return (
    <div className="page room">
      <button className="btn btn-ghost" onClick={onExit}>{t("back")}</button>

      {game ? (
        <div className="room-layout">
          <div className="card room-card">
            <div className="kv">
              <span>{t("gameId")} #{game.id}</span>
              <span>
                {t("stakeOf")}:{" "}
                {Number(formatStake(game.stakeCreator, decimals)).toLocaleString("en-US")} +{" "}
                {Number(formatStake(game.stakeChallenger, decimals)).toLocaleString("en-US")} ●
              </span>
            </div>
            <div className="players">
              <PlayerRow data={clockOf("w")} />
              <PlayerRow data={clockOf("b")} />
            </div>
            <div className={`turn-pill ${chess.turn() === myColor ? "you" : "opp"}`}>
              {status === 1 && !isOver ? (chess.turn() === myColor ? t("yourTurn") : t("opponentTurn")) : "—"}
            </div>
            <GamePlayback
              board={chess.board()}
              myColor={myColor}
              selected={selected}
              targets={targets}
              onSquare={handleSquare}
              disabled={isOver || chess.turn() !== myColor || !relayConnected}
              moves={moves}
              moveIndex={moveIndex}
              onMoveIndexChange={selectMoveIndex}
            />
            <p className={`small ${relayUnavailable ? "warn" : "muted"}`} role="status">
              {relayUnavailable
                ? t("relayUnavailable")
                : relayConnected
                  ? t("relayConnected")
                  : t("relayConnecting")}
            </p>
            <div className="room-actions">
              {banner === "timeout-mine" && (
                <button className="btn btn-danger" onClick={resign}>{t("resignTimeout")}</button>
              )}
              {banner === "timeout-theirs" && <p className="muted">{t("waitTimeout")}</p>}
              {banner === "mate" && <p className="muted">{t("checkmate")}</p>}
              {banner === "stale" && <p className="muted">{t("stalemate")}</p>}
              {status === 1 && (
                <>
                  <button className="btn btn-ghost" onClick={agreeDraw}>
                    {(myColor === "w" ? game?.creatorDraw : game?.challengerDraw) ? t("drawWaiting") : t("offerDraw")}
                  </button>
                  <button className="btn btn-ghost" onClick={resign}>{t("resign")}</button>
                </>
              )}
            </div>
            {resultText && <div className="result">{resultText}</div>}
            {status === 0 && (
              <InviteCard
                title={t("inviteGame")}
                note={t("inviteGameNote")}
                url={`${window.location.origin}${window.location.pathname}?game=${game.id}`}
                text={t("inviteGameMsg", { id: game.id }) + " " + `${window.location.origin}${window.location.pathname}?game=${game.id}`}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="card"><p>{t("needLink")}</p></div>
      )}
      <p className="visually-hidden">{iAmCreator ? "creator" : "challenger"} {fen}</p>
      <VictoryCelebration winner={winnerName} />
    </div>
  );
}

function PlayerRow({ data }) {
  const { t } = useTranslation();
  return (
    <div className={`player ${data.active ? "player-active" : ""}`}>
      <div>
        <b>{data.name} {data.you && "· " + t("you")}</b>
        <small>{shortAddr(data.addr)}</small>
      </div>
      <div className={`clock ${data.time <= 0 ? "clock-out" : ""}`}>{fmtTime(data.time)}</div>
    </div>
  );
}
