"use client";

import { WINNING_SCORE } from "@/lib/scoring";

const HOLES_PER_ROW = 21;
const ROWS = Math.ceil(WINNING_SCORE / HOLES_PER_ROW);

function holePosition(score: number) {
  const i = Math.max(0, Math.min(score, WINNING_SCORE));
  const row = Math.min(Math.floor(i / HOLES_PER_ROW), ROWS - 1);
  const colInRow = i - row * HOLES_PER_ROW;
  const displayCol = row % 2 === 0 ? colInRow : HOLES_PER_ROW - 1 - colInRow;
  return { row, col: displayCol };
}

function Peg({
  score,
  color,
  label,
  ghost = false,
}: {
  score: number;
  color: string;
  label: string;
  ghost?: boolean;
}) {
  const { row, col } = holePosition(score);
  return (
    <div
      className="absolute flex items-center justify-center transition-all duration-500 ease-out"
      style={{
        top: `calc(${row} * (100% / ${ROWS}) + (100% / ${ROWS}) / 2)`,
        left: `calc(${col} * (100% / ${HOLES_PER_ROW}) + (100% / ${HOLES_PER_ROW}) / 2)`,
        transform: "translate(-50%, -50%)",
        width: "min(4.2vw, 22px)",
        height: "min(4.2vw, 22px)",
      }}
      aria-hidden
    >
      <div
        className="rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.6)] border"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: color,
          opacity: ghost ? 0.35 : 1,
          borderColor: "rgba(0,0,0,0.35)",
        }}
        title={label}
      />
    </div>
  );
}

export default function PeggingBoard({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Prev,
  player2Prev,
}: {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Prev: number;
  player2Prev: number;
}) {
  const rowsArr = Array.from({ length: ROWS });

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-brass-light/80 mb-2 font-body">
        <span>{player1Name}</span>
        <span>{WINNING_SCORE} to win</span>
        <span>{player2Name}</span>
      </div>
      <div
        className="relative rounded-xl border border-brass/40 bg-walnut-deep p-3 shadow-inner"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(176,141,87,0.05) 0px, rgba(176,141,87,0.05) 2px, transparent 2px, transparent 14px)",
        }}
      >
        <div
          className="relative"
          style={{ aspectRatio: `${HOLES_PER_ROW} / ${ROWS}` }}
        >
          {rowsArr.map((_, r) => (
            <div
              key={r}
              className="absolute w-full flex"
              style={{
                top: `calc(${r} * (100% / ${ROWS}))`,
                height: `calc(100% / ${ROWS})`,
              }}
            >
              {Array.from({ length: HOLES_PER_ROW }).map((_, c) => (
                <div
                  key={c}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="w-[5px] h-[5px] rounded-full bg-track/25" />
                </div>
              ))}
            </div>
          ))}

          {/* ghost (previous) pegs show the classic leap-frog reference point */}
          <Peg score={player1Prev} color="#D4B483" label={`${player1Name} prior`} ghost />
          <Peg score={player2Prev} color="#7FA6A0" label={`${player2Name} prior`} ghost />
          <Peg score={player1Score} color="#D4B483" label={player1Name} />
          <Peg score={player2Score} color="#7FA6A0" label={player2Name} />
        </div>
      </div>
      <div className="flex justify-between mt-2 font-score text-2xl">
        <span style={{ color: "#D4B483" }}>{player1Score}</span>
        <span style={{ color: "#7FA6A0" }}>{player2Score}</span>
      </div>
    </div>
  );
}
