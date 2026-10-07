import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import Board from "./Board";

export function GamePlayback({
  board,
  myColor,
  selected,
  targets,
  onSquare,
  disabled,
  moves,
  moveIndex,
  onMoveIndexChange,
}) {
  const { t } = useTranslation();
  const viewingHistory = moveIndex < moves.length;
  const displayedBoard = viewingHistory
    ? boardAtPly(moves, moveIndex)
    : board;
  const moveRows = [];
  for (let index = 0; index < moves.length; index += 2) {
    moveRows.push(moves.slice(index, index + 2));
  }

  return (
    <div className="game-playback">
      <div className="board-column">
        <Board
          board={displayedBoard}
          myColor={myColor}
          selected={viewingHistory ? null : selected}
          targets={viewingHistory ? [] : targets}
          onSquare={onSquare}
          disabled={disabled || viewingHistory}
        />
        <div className="move-navigation">
          <button
            className="btn btn-ghost"
            onClick={() => onMoveIndexChange(Math.max(0, moveIndex - 1))}
            disabled={moveIndex === 0}
            aria-label={t("previousMove")}
          >
            ← {t("previousMove")}
          </button>
          <span className="muted small">
            {t("moveCount", {
              current: Math.ceil(moveIndex / 2),
              total: Math.ceil(moves.length / 2),
            })}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => onMoveIndexChange(Math.min(moves.length, moveIndex + 1))}
            disabled={moveIndex === moves.length}
            aria-label={t("nextMove")}
          >
            {t("nextMove")} →
          </button>
        </div>
      </div>
      <aside className="move-history">
        <h3>{t("moveHistory")}</h3>
        {moveRows.length ? (
          <ol>
            {moveRows.map((row, rowIndex) => (
              <li key={rowIndex}>
                <span className="move-number">{rowIndex + 1}.</span>
                {row.map((move, colorIndex) => {
                  const ply = rowIndex * 2 + colorIndex + 1;
                  return (
                    <button
                      key={ply}
                      className={`move-entry ${moveIndex === ply ? "move-entry-active" : ""}`}
                      onClick={() => onMoveIndexChange(ply)}
                      aria-label={t("viewMove", { move: ply, san: move.san })}
                    >
                      {move.san}
                    </button>
                  );
                })}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">{t("noMoves")}</p>
        )}
      </aside>
    </div>
  );
}

export function VictoryCelebration({ winner, onClose }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  useEffect(() => setVisible(true), [winner]);

  if (!winner || !visible) return null;

  return (
    <div className="victory-overlay" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="victory-confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => (
          <i
            key={index}
            style={{
              "--confetti-left": `${(index * 37) % 100}%`,
              "--confetti-hue": `${(index * 47) % 360}`,
              "--confetti-delay": `${-(index % 10) * 0.25}s`,
            }}
          />
        ))}
      </div>
      <div className="victory-card">
        <div className="victory-trophy" aria-hidden="true">🏆</div>
        <p>{t("congratulations")}</p>
        <h2 id="victory-title">{winner}</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
        >
          {t("continue")}
        </button>
      </div>
    </div>
  );
}

function boardAtPly(moves, ply) {
  const replay = new Chess();
  for (const move of moves.slice(0, ply)) {
    replay.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || "q",
    });
  }
  return replay.board();
}
