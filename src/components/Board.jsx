// Шахматная доска с CSS Grid - гарантирует 8x8 клеток
const PIECES = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export default function Board({ board, myColor, selected, targets, onSquare, disabled }) {
  // Для белых: ряд 0 = 8-я горизонталь (сверху)
  // Для чёрных: переворачиваем доску
  const flipped = myColor === "b";
  const displayRows = flipped ? [...board].reverse() : board;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  return (
    <div className="board-wrapper">
      {/* Вертикальные координаты (цифры 1-8) */}
      <div className="board-coords-ranks">
        {displayRanks.map((rank) => (
          <span key={rank} className="coord">{rank}</span>
        ))}
      </div>

      {/* Сама доска */}
      <div className={`board ${disabled ? "board-disabled" : ""}`}>
        {displayRows.map((row, r) => (
          <div className="board-row" key={r}>
            {row.map((piece, c) => {
              // Вычисляем реальные координаты клетки
              const fileIdx = flipped ? 7 - c : c;
              const rankIdx = flipped ? 7 - r : r;
              const file = FILES[fileIdx];
              const rank = RANKS[rankIdx];
              const square = `${file}${rank}`;
              
              const dark = (fileIdx + rankIdx) % 2 === 1;
              const isSel = selected === square;
              const isTarget = targets.includes(square);
              const showFileCoord = r === 7;
              const showRankCoord = c === 0;

              return (
                <button
                  key={square}
                  className={`cell ${dark ? "dark" : "light"} ${isSel ? "sel" : ""} ${isTarget ? "target" : ""}`}
                  onClick={() => onSquare(square)}
                  aria-label={square}
                  disabled={disabled}
                >
                  {piece && (
                    <span className={piece.color === "w" ? "pw" : "pb"}>
                      {PIECES[piece.color + piece.type]}
                    </span>
                  )}
                  {isTarget && !piece && <span className="dot" />}
                  {isTarget && piece && <span className="ring" />}
                  
                  {/* Координаты на клетках */}
                  {showFileCoord && (
                    <span className={`cell-coord file-coord ${dark ? "on-dark" : "on-light"}`}>
                      {file}
                    </span>
                  )}
                  {showRankCoord && (
                    <span className={`cell-coord rank-coord ${dark ? "on-dark" : "on-light"}`}>
                      {rank}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Горизонтальные координаты (буквы a-h) */}
      <div className="board-coords-files">
        {displayFiles.map((file) => (
          <span key={file} className="coord">{file}</span>
        ))}
      </div>
    </div>
  );
}
