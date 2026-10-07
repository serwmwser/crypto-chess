import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FREE_TIME_CONTROLS, RELAY_URL } from "../lib/config";
import { getFreePlayerId } from "../lib/freeGames";

export default function FreeGamesList({ games, onResume, onDelete, notify }) {
  const { t } = useTranslation();
  const [liveGames, setLiveGames] = useState([]);
  const socketRef = useRef(null);
  const playerId = getFreePlayerId();

  useEffect(() => {
    let alive = true;
    let ws;
    let refreshTimer;
    try {
      ws = new WebSocket(RELAY_URL);
      socketRef.current = ws;
      const requestGames = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "list-free-games", playerId }));
        }
      };
      ws.onopen = () => {
        requestGames();
        refreshTimer = window.setInterval(requestGames, 15000);
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "free-games" && Array.isArray(message.games)) {
            setLiveGames(message.games);
            for (const id of message.removedIds || []) onDelete(id);
          } else if (message.type === "free-game-deleted") {
            onDelete?.(message.id);
          } else if (message.type === "relay-error") {
            notify?.(message.message);
          }
        } catch (error) {
          console.error("Could not read free match list response:", error);
        }
      };
      ws.onerror = () => {
        if (alive) console.error("Could not connect to the free match list relay.");
      };
    } catch (error) {
      console.error("Could not open free match list connection:", error);
    }

    return () => {
      alive = false;
      window.clearInterval(refreshTimer);
      ws?.close();
      socketRef.current = null;
    };
  }, [playerId, onDelete, notify]);

  const ownGames = games.filter((game) => game.mode === "online").map((game) => {
    const liveGame = liveGames.find((item) => item.id === game.roomId);
    return {
      ...game,
      status: game.status || (game.isHost ? "waiting" : "joining"),
      serverKnown: Boolean(liveGame),
      ...liveGame,
    };
  });
  const openGames = liveGames.filter((game) => game.status === "waiting" && !game.isOwner);

  function deleteGame(game) {
    if (game.status !== "waiting" || !game.isHost) {
      notify?.(t("freeGameDeleteUnavailable"));
      return;
    }
    if (!game.serverKnown || socketRef.current?.readyState !== WebSocket.OPEN) {
      onDelete?.(game.roomId);
      notify?.(t("freeGameRemovedLocally"));
      return;
    }
    if (!game.isOwner) {
      notify?.(t("freeGameDeleteUnavailable"));
      return;
    }
    socketRef.current.send(
      JSON.stringify({ type: "delete-free-game", id: game.id, playerId })
    );
  }

  function gameStatusLabel(game) {
    if (game.status === "active") return t("inProgress");
    if (game.status === "expired") return t("freeMatchExpired");
    if (game.status === "deleted") return t("freeMatchDeleted");
    return t("freeMatchWaiting");
  }

  return (
    <div className="free-games-list">
      <h4>{t("myFreeGames")}</h4>
      {ownGames.length ? (
        <ul className="gamelist">
          {ownGames.map((game) => (
            <li className="game-item" key={game.roomId}>
              <span className="gid">
                ♞ {game.mode === "bot" ? t("botOpponent") : t("opponentPlayer")}
              </span>
              <span>{t("freePlayersCount", { count: game.playerCount || (game.status === "active" ? 2 : 1) })}</span>
              <span className="muted">{gameStatusLabel(game)}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onResume(game)}
                disabled={game.status === "expired" || game.status === "deleted"}
              >
                {t("play")}
              </button>
              {game.isHost && game.status === "waiting" && (
                <button className="btn btn-danger btn-sm" onClick={() => deleteGame(game)}>
                  {t("deleteFreeGame")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("noFreeGames")}</p>
      )}
      <h4 className="free-games-subtitle">{t("openFreeGames")}</h4>
      {openGames.length ? (
        <ul className="gamelist">
          {openGames.map((game) => (
            <li className="game-item" key={game.id}>
              <span className="gid">♞ {t("opponentPlayer")}</span>
              <span>{t(FREE_TIME_CONTROLS.find((control) => control.value === Math.round(game.clockSeconds / 60))?.key || "t5")}</span>
              <span className="muted">{t("freeMatchWaiting")}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onResume({
                  roomId: game.id,
                  mode: "online",
                  minutes: Math.round(game.clockSeconds / 60),
                  isHost: false,
                })}
              >
                {t("join")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("noOpenFreeGames")}</p>
      )}
    </div>
  );
}
