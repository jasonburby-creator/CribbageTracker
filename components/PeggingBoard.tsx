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
        className="relative rounded-lg border border-brass/30 px-3 py-2.5"
        style={{
          backgroundColor: "#241512",
          backgroundImage:
            "repeating-linear-gradient(100deg, rgba(90,58,40,0.5) 0px, rgba(90,58,40,0.5) 3px, rgba(46,26,18,0.5) 3px, rgba(46,26,18,0.5) 7px), radial-gradient(ellipse at 30% -20%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.55)",
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
                const isMileMarker = i % 5 === 0;
                return (
                  <div key={c} className="flex-1 flex items-center justify-center">
                    {marker ? (
                      <div
                        className="rounded-full"
                        style={{
                          width: "9px",
                          height: "9px",
                          backgroundColor: marker.color,
                          boxShadow: `0 0 7px ${marker.color}, inset 0 1px 1px rgba(255,255,255,0.5)`,
                        }}
                      />
                    ) : (
                      <div
                        className="rounded-full"
                        style={{
                          width: isMileMarker ? "6px" : "4.5px",
                          height: isMileMarker ? "6px" : "4.5px",
                          background:
                            "radial-gradient(circle at 35% 30%, rgba(20,10,8,0.9), rgba(0,0,0,0.95) 60%)",
                          boxShadow: isMileMarker
                            ? "inset 0 1px 2px rgba(0,0,0,0.9), 0 0.5px 0 rgba(237,228,211,0.15)"
                            : "inset 0 1px 1px rgba(0,0,0,0.85)",
                          border: isMileMarker ? "1px solid rgba(176,141,87,0.25)" : "none",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ghost (previous) peg shows the classic leap-frog reference point */}
          <div
            className="absolute rounded-full transition-all duration-500 ease-out"
            style={{
              top: `calc(${ghost.row} * (100% / ${ROWS}) + (100% / ${ROWS}) / 2)`,
              left: `calc(${ghost.col} * (100% / ${HOLES_PER_ROW}) + (100% / ${HOLES_PER_ROW}) / 2)`,
              transform: "translate(-50%, -50%)",
              width: "min(3.6vw, 18px)",
              height: "min(3.6vw, 18px)",
              background: `radial-gradient(circle at 35% 30%, ${pegColor}, ${pegColor}99 70%)`,
              opacity: 0.4,
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
            aria-hidden
          />
          <div
            className="absolute rounded-full transition-all duration-500 ease-out"
            style={{
              top: `calc(${peg.row} * (100% / ${ROWS}) + (100% / ${ROWS}) / 2)`,
              left: `calc(${peg.col} * (100% / ${HOLES_PER_ROW}) + (100% / ${HOLES_PER_ROW}) / 2)`,
              transform: "translate(-50%, -50%)",
              width: "min(4.6vw, 23px)",
              height: "min(4.6vw, 23px)",
              background: `radial-gradient(circle at 32% 28%, #ffffffcc 0%, ${pegColor} 30%, ${pegColor} 65%, rgba(0,0,0,0.5) 100%)`,
              boxShadow: `0 2px 4px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.3)`,
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
        className="relative rounded-xl p-3 space-y-3"
        style={{
          backgroundColor: "#4A2E22",
          backgroundImage:
            "repeating-linear-gradient(3deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 5px), linear-gradient(160deg, #5A3826 0%, #3A2318 100%)",
          border: `1px solid ${accent.color}66`,
          boxShadow: `0 4px 18px rgba(0,0,0,0.5), 0 0 24px ${accent.glow}`,
        }}
      >
        {/* brass corner screws for the carved-board look */}
        {[
          { top: "6px", left: "6px" },
          { top: "6px", right: "6px" },
          { bottom: "6px", left: "6px" },
          { bottom: "6px", right: "6px" },
        ].map((pos, idx) => (
          <div
            key={idx}
            className="absolute rounded-full"
            style={{
              ...pos,
              width: "7px",
              height: "7px",
              background: "radial-gradient(circle at 35% 30%, #E8D2A0, #8A6A3A 70%)",
              boxShadow: "0 1px 1px rgba(0,0,0,0.6)",
            }}
          />
        ))}

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
