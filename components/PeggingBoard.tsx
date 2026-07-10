"use client";

import { SKUNK_THRESHOLD, DOUBLE_SKUNK_THRESHOLD, WINNING_SCORE } from "@/lib/scoring";

// Simplified score track: two straight left→right lanes (one per player),
// running 0 → 121, modeled on the physical "Outside Inside" travel board —
// flat gray body, an orange lane and a teal lane. The score readout lives in
// GameLive; this is just the visual position on the track.

const P1_COLOR = "#F27A21"; // Safety Orange (player 1)
const P2_COLOR = "#197B8F"; // Trail Blue (player 2)
const P2_PEG = "#2FA7BE"; // brighter teal so the peg reads on the lane

const VB = { w: 400, h: 168 };
const X0 = 46; // score 0
const X1 = 366; // score 121
const LANE_Y = [64, 116]; // top = player 1, bottom = player 2

function xFor(score: number) {
  const s = Math.max(0, Math.min(WINNING_SCORE, score));
  return X0 + (s / WINNING_SCORE) * (X1 - X0);
}

function Peg({
  x,
  y,
  color,
  ghost,
}: {
  x: number;
  y: number;
  color: string;
  ghost?: boolean;
}) {
  return (
    <g
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      aria-hidden
    >
      {ghost ? (
        <circle r="3.6" fill={color} opacity="0.35" />
      ) : (
        <>
          <circle r="7" fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" />
          <circle cx="-2" cy="-2.2" r="2" fill="rgba(255,255,255,0.8)" />
        </>
      )}
    </g>
  );
}

export default function PeggingBoard({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Prev,
  player2Prev,
  boardName = "",
}: {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Prev: number;
  player2Prev: number;
  themeText?: string; // accepted for compatibility; unused
  boardName?: string;
}) {
  const lanes = [
    { color: P1_COLOR, peg: P1_COLOR, score: player1Score, prev: player1Prev, name: player1Name },
    { color: P2_COLOR, peg: P2_PEG, score: player2Score, prev: player2Prev, name: player2Name },
  ];

  const markers = [
    { score: SKUNK_THRESHOLD, label: "SKUNK" },
    { score: DOUBLE_SKUNK_THRESHOLD, label: "DBL SKUNK" },
  ];

  return (
    <svg
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Score track: ${player1Name} ${player1Score}, ${player2Name} ${player2Score}`}
      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))" }}
    >
      {/* flat gray body */}
      <rect x="6" y="8" width="388" height="152" rx="20" fill="#7A848B" stroke="#3A3D40" strokeWidth="3" />
      <rect x="12" y="14" width="376" height="140" rx="15" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* board-name badge */}
      {boardName && (
        <>
          <rect x="300" y="132" width="78" height="18" rx="9" fill={P2_COLOR} opacity="0.9" />
          <text x="339" y="144" textAnchor="middle" fontSize="8" letterSpacing="1.5" fill="#F4F4F1" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            {boardName.toUpperCase().slice(0, 14)}
          </text>
        </>
      )}

      {/* skunk / double-skunk markers — neutral gray so they don't read as pegs */}
      {markers.map((m) => {
        const x = xFor(m.score);
        return (
          <g key={m.score}>
            <line x1={x} y1="40" x2={x} y2="140" stroke="rgba(0,0,0,0.45)" strokeWidth="1.4" strokeDasharray="3 3" />
            <text x={x} y="34" textAnchor="middle" fontSize="7" letterSpacing="1" fill="rgba(0,0,0,0.55)" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
              {m.label}
            </text>
          </g>
        );
      })}

      {/* lanes */}
      {lanes.map((lane, p) => {
        const y = LANE_Y[p];
        const holes = [];
        for (let s = 0; s <= 120; s += 4) {
          holes.push(<circle key={s} cx={xFor(s)} cy={y} r="2" fill="rgba(0,0,0,0.45)" />);
        }
        return (
          <g key={p}>
            <rect x={X0 - 16} y={y - 13} width={X1 - X0 + 40} height="26" rx="13" fill={lane.color} opacity="0.5" />
            <rect x={X0 - 16} y={y - 13} width={X1 - X0 + 40} height="26" rx="13" fill="none" stroke={lane.color} strokeWidth="1" opacity="0.7" />
            {holes}
            <text x={X0 - 26} y={y + 3} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.7)" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
              0
            </text>
            <circle cx={xFor(WINNING_SCORE)} cy={y} r="5" fill="#3A3D40" stroke="#F4F4F1" strokeWidth="1.3" />
          </g>
        );
      })}

      {/* START + game-hole labels */}
      <text x={X0 - 16} y="22" textAnchor="start" fontSize="7" letterSpacing="1.5" fill="rgba(255,255,255,0.65)" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
        START
      </text>
      <text x={xFor(WINNING_SCORE)} y="150" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.75)" style={{ fontFamily: "var(--font-mono), monospace" }}>
        {WINNING_SCORE}
      </text>

      {/* ghost (previous) pegs, then current pegs */}
      {lanes.map((lane, p) => (
        <Peg key={`g${p}`} x={xFor(lane.prev)} y={LANE_Y[p]} color={lane.peg} ghost />
      ))}
      {lanes.map((lane, p) => (
        <Peg key={`p${p}`} x={xFor(lane.score)} y={LANE_Y[p]} color={lane.peg} />
      ))}
    </svg>
  );
}
