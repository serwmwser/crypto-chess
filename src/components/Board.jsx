// Премиальная шахматная доска: CSS Grid 8x8, залитые фигуры, координаты внутри клеток
const FILLED_PIECES = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function Board({ board, myColor, selected, targets, onSquare, disabled }) {
  const flipped = myColor === "b";
  const rows = flipped ? [...board].reverse() : board;

  return (
    <div className="board-frame">
      <div className={`board ${disabled ? "board-disabled" : ""}`}>
        {rows.map((row, r) =>
          row.map((piece, c) => {
            const fileIdx = flipped ? 7 - c : c;
            const rankIdx = flipped ? 7 - r : r;
            const file = FILES[fileIdx];
            const rank = String(8 - rankIdx);
            const square = `${file}${rank}`;
            const dark = (fileIdx + rankIdx) % 2 === 1;
            const isSel = selected === square;
            const isTarget = targets.includes(square);

            return (
              <button
                key={square}
                className={`cell ${dark ? "dark" : "light"} ${isSel ? "sel" : ""} ${isTarget ? "target" : ""}`}
                onClick={() => onSquare(square)}
                disabled={disabled}
                aria-label={square}
              >
                {piece && (
                  <span className={`piece ${piece.color === "w" ? "pw" : "pb"}`}>
                    {FILLED_PIECES[piece.type]}
                  </span>
                )}
                {isTarget && !piece && <span className="dot" />}
                {isTarget && piece && <span className="ring" />}
                {c === 0 && (
                  <span className={`coord coord-rank ${dark ? "on-dark" : "on-light"}`}>
                    {rank}
                  </span>
                )}
                {r === 7 && (
                  <span className={`coord coord-file ${dark ? "on-dark" : "on-light"}`}>
                    {file}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
