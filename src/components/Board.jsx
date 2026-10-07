// Шахматная доска. board — результат chess.board() (8 рядов, первый = 8-я ранка).
const PIECES = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

export default function Board({ board, myColor, selected, targets, onSquare, disabled }) {
  const files = "abcdefgh";
  const display = myColor === "w" ? board : [...board].reverse();
  
  return (
    <div className={`board ${disabled ? "board-disabled" : ""}`}>
      {display.map((row, r) => {
        const cells = myColor === "w" ? row : [...row].reverse();
        return (
          <div className="board-row" key={r}>
            {cells.map((piece, c) => {
              const boardRow = myColor === "w" ? r : 7 - r;
              const boardColumn = myColor === "w" ? c : 7 - c;
              const rank = 8 - boardRow;
              const square = `${files[boardColumn]}${rank}`;
              const file = boardColumn;
              const dark = (file + rank) % 2 === 1;
              const isSel = selected === square;
              const isTarget = targets.includes(square);
              const label = files[file] + rank;
              
              return (
                <button
                  key={square}
                  className={`cell ${dark ? "dark" : "light"} ${isSel ? "sel" : ""}`}
                  onClick={() => onSquare(square)}
                  aria-label={label}
                  disabled={disabled}
                >
                  {piece ? (
                    <span className={piece.color === "w" ? "pw" : "pb"}>
                      {PIECES[piece.color + piece.type]}
                    </span>
                  ) : null}
                  {isTarget && !piece && <span className="dot" />}
                  {isTarget && piece && <span className="ring" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
