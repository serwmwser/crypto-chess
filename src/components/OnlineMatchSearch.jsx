import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FREE_TIME_CONTROLS, RELAY_URL } from "../lib/config";
import { getFreePlayerId } from "../lib/freeGames";

export default function OnlineMatchSearch({ minutes, onMatch, notify }) {
  const { t } = useTranslation();
  const [searching, setSearching] = useState(false);
  const [waitingPlayers, setWaitingPlayers] = useState(0);

  useEffect(() => {
    if (!searching) return undefined;

    let alive = true;
    let ws;
    try {
      ws = new WebSocket(RELAY_URL);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "find-match",
          playerId: getFreePlayerId(),
          clockSeconds: minutes * 60,
        }));
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "queue-status") {
            setWaitingPlayers(message.waitingPlayers);
          } else if (message.type === "match-found") {
            if (!alive) return;
            setSearching(false);
            onMatch({
              roomId: message.id,
              mode: "online",
              minutes: Math.round(message.clockSeconds / 60),
              isHost: message.isHost,
            });
          } else if (message.type === "relay-error") {
            notify?.(message.message);
            setSearching(false);
          }
        } catch (error) {
          console.error("Could not read matchmaking response:", error);
          notify?.(error.message || String(error));
        }
      };
      ws.onerror = () => {
        if (!alive) return;
        notify?.(t("matchmakingUnavailable"));
        setSearching(false);
      };
      ws.onclose = () => {
        if (alive && searching) {
          setSearching(false);
          notify?.(t("matchmakingDisconnected"));
        }
      };
    } catch (error) {
      notify?.(error.message || String(error));
      setSearching(false);
    }

    return () => {
      alive = false;
      ws?.close();
    };
  }, [searching, minutes, onMatch, notify, t]);

  return (
    <div className="match-search">
      <button
        className={`btn ${searching ? "btn-ghost" : "btn-primary"}`}
        onClick={() => setSearching((value) => !value)}
      >
        {searching ? t("cancelSearch") : t("findOnlinePlayer")}
      </button>
      {searching && (
        <span className="match-search-status" aria-live="polite">
          <i className="match-search-pulse" />
          {t("searchingForPlayer", {
            count: waitingPlayers,
            time: t(FREE_TIME_CONTROLS.find((control) => control.value === minutes)?.key || "t5"),
          })}
        </span>
      )}
    </div>
  );
}
