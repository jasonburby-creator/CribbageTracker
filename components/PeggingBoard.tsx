"use client";

import { SKUNK_THRESHOLD, DOUBLE_SKUNK_THRESHOLD, WINNING_SCORE } from "@/lib/scoring";
import { getThemeAccent } from "@/lib/theme";

const HOLES_PER_ROW = 21;
const ROWS = Math.ceil(WINNING_SCORE / HOLES_PER_ROW);

function holePosition(score: number) {
  const i = Math.max(0, Math.min(score, WINNING_SCORE));
  const row = Math.min(Math.floor(i / HOLES_PER_ROW), ROWS - 1);
  const colInRow = i - row * HOLES_PER_ROW;
  const displayCol = row % 2 === 0 ? colInRow : HOLES_PER_ROW - 1 - colInRow;
  return { row, col: displayCol };
}

// The two skunk thresholds are opponent scores, i.e. "if the loser is below
// this many points when the winner hits 121." We mark them on each lane at
// their own position so a player can see at a glance whether they're still
// safe, in skunk range, or in double-skunk range.
const SKUNK_MARKERS = [
  { score: SKUNK_THRESHOLD, label: "SKUNK", color: "#D4A72C" },
  { score: DOUBLE_SKUNK_THRESHOLD, label: "DBL SKUNK", color: "#C1432A" },
];

function Lane({
  playerName,
  score,
  prevScore,
  pegColor,
}: {
  playerName: string;
  score: number;
  prevScore: number;
  pegColor: string;
}) {
  const rowsArr = Array.from({ length: ROWS });
  const peg = holePosition(score);
  const ghost = holePosition(prevScore);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-brass-light/70 mb-1.5 font-body">
        {playerName}
        <span className="ml-2 font-score text-sm text-track normal-case tracking-normal">
          {score}
        </span>
      </p>
      <div
        className="relative rounded-lg border border-brass/30 bg-walnut-deep px-3 py-2.5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(176,141,87,0.05) 0px, rgba(176,141,87,0.05) 2px, transparent 2px, transparent 14px)",
        }}
      >
        <div className="relative" style={{ aspectRatio: `${HOLES_PER_ROW} / ${ROWS}` }}>
          {rowsArr.map((_, r) => (
            <div
              key={r}
              className="absolute w-full flex"
              style={{
                top: `calc(${r} * (100% / ${ROWS}))`,
                height: `calc(100% / ${ROWS})`,
              }}
            >
              {Array.from({ length: HOLES_PER_ROW }).map((_, c) => {
                const i = r % 2 === 0 ? r * HOLES_PER_ROW + c : r * HOLES_PER_ROW + (HOLES_PER_ROW - 1 - c);
                const marker = SKUNK_MARKERS.find((m) => m.score === i);
                return (
                  <div key={c} className="flex-1 flex items-center justify-center">
                    <div
                      className="rounded-full"
                      style={{
                        width: marker ? "8px" : "5px",
                        height: marker ? "8px" : "5px",
                        backgroundColor: marker ? marker.color : "rgba(237,228,211,0.25)",
                        boxShadow: marker ? `0 0 6px ${marker.color}` : "none",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {/* ghost (previous) peg shows the classic leap-frog reference point */}
          <div
            className="absolute rounded-full border transition-all duration-500 ease-out"
            style={{
              top: `calc(${ghost.row} * (100% / ${ROWS}) + (100% / ${ROWS}) / 2)`,
              left: `calc(${ghost.col} * (100% / ${HOLES_PER_ROW}) + (100% / ${HOLES_PER_ROW}) / 2)`,
              transform: "translate(-50%, -50%)",
              width: "min(4vw, 20px)",
              height: "min(4vw, 20px)",
              backgroundColor: pegColor,
              opacity: 0.35,
              borderColor: "rgba(0,0,0,0.35)",
            }}
            aria-hidden
          />
          <div
            className="absolute rounded-full border shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-all duration-500 ease-out"
            style={{
              top: `calc(${peg.row} * (100% / ${ROWS}) + (100% / ${ROWS}) / 2)`,
              left: `calc(${peg.col} * (100% / ${HOLES_PER_ROW}) + (100% / ${HOLES_PER_ROW}) / 2)`,
              transform: "translate(-50%, -50%)",
              width: "min(4vw, 20px)",
              height: "min(4vw, 20px)",
              backgroundColor: pegColor,
              borderColor: "rgba(0,0,0,0.35)",
            }}
            aria-hidden
          />
        </div>
      </div>
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
  themeText = "",
}: {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Prev: number;
  player2Prev: number;
  themeText?: string;
}) {
  const accent = getThemeAccent(themeText);

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-lg">{accent.icon}</span>
        <span className="text-xs uppercase tracking-[0.3em] text-brass-light/70">
          {WINNING_SCORE} to win
        </span>
        <span className="text-lg">{accent.icon}</span>
      </div>

      <div
        className="rounded-xl p-3 space-y-3"
        style={{
          border: `1px solid ${accent.color}66`,
          boxShadow: `0 0 24px ${accent.glow}`,
        }}
      >
        <Lane
          playerName={player1Name}
          score={player1Score}
          prevScore={player1Prev}
          pegColor="#D4B483"
        />
        <Lane
          playerName={player2Name}
          score={player2Score}
          prevScore={player2Prev}
          pegColor="#7FA6A0"
        />
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] uppercase tracking-widest text-track/50">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#D4A72C", boxShadow: "0 0 4px #D4A72C" }}
          />
          Skunk line ({SKUNK_THRESHOLD})
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#C1432A", boxShadow: "0 0 4px #C1432A" }}
          />
          Double skunk ({DOUBLE_SKUNK_THRESHOLD})
        </span>
      </div>
    </div>
  );
}
