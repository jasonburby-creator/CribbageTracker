"use client";

import { useMemo } from "react";
import { SKUNK_THRESHOLD, DOUBLE_SKUNK_THRESHOLD, WINNING_SCORE } from "@/lib/scoring";
import { getBoardTheme, type BoardTheme, type EmblemId } from "@/lib/theme";
import { getBoardShape } from "@/lib/boardShapes";
import { EMBLEMS } from "@/lib/emblems";

// Traditional serpentine layout: 4 streets of 30 holes (grouped in 5s, like a
// carved board), concentric 180° turnarounds at the ends, two parallel lanes
// that swap inner/outer through each turn — exactly how a physical board runs.
// Track coordinates are fixed; the themed silhouette is drawn around them.
const HOLES_PER_STREET = 30;
const STREETS = 4;
const STEP = 10.2; // hole-to-hole spacing
const GROUP_GAP = 6.4; // extra gap after every group of 5
const LANE_GAP = 7; // half-distance between the two lanes of a street

const X_LEFT = 46;
const X_RIGHT =
  X_LEFT + (HOLES_PER_STREET - 1) * STEP + (HOLES_PER_STREET / 5 - 1) * GROUP_GAP;
const STREET_Y = [96, 160, 224, 288];
const START_X = X_LEFT - 17;
const START_X2 = X_LEFT - 28;
const FINISH = { x: 22, y: STREET_Y[3] };
const CENTER_X = 210; // mirror axis for decorative work

const SKUNK_MARKERS = [
  { score: SKUNK_THRESHOLD, color: "#D4A72C", label: "SKUNK" },
  { score: DOUBLE_SKUNK_THRESHOLD, color: "#C1432A", label: "DBL SKUNK" },
];

function holeOffset(pos: number) {
  return pos * STEP + Math.floor(pos / 5) * GROUP_GAP;
}

// Lanes swap sides through each concentric turn, so a lane's offset sign
// alternates per street (this is what makes the turnarounds concentric).
function laneY(street: number, lane: 0 | 1) {
  const sign = (lane === 0 ? -1 : 1) * (street % 2 === 0 ? 1 : -1);
  return STREET_Y[street] + sign * LANE_GAP;
}

function holeXY(score: number, lane: 0 | 1) {
  const s = Math.max(0, Math.min(score, WINNING_SCORE));
  if (s === 0) return { x: START_X, y: laneY(0, lane) };
  if (s >= WINNING_SCORE) return { x: FINISH.x, y: FINISH.y };
  const i = s - 1;
  const street = Math.floor(i / HOLES_PER_STREET);
  const pos = i % HOLES_PER_STREET;
  const x =
    street % 2 === 0 ? X_LEFT + holeOffset(pos) : X_RIGHT - holeOffset(pos);
  return { x, y: laneY(street, lane) };
}

// One continuous groove per lane: start holes → four streets → turnaround
// arcs → a final curve into the shared game hole.
function lanePath(lane: 0 | 1) {
  let d = `M ${START_X2} ${laneY(0, lane)}`;
  for (let street = 0; street < STREETS; street++) {
    const y = laneY(street, lane);
    const xEnd = street % 2 === 0 ? X_RIGHT : X_LEFT;
    d += ` L ${xEnd} ${y}`;
    if (street < STREETS - 1) {
      const yNext = laneY(street + 1, lane);
      const r = Math.abs(yNext - y) / 2;
      const sweep = street % 2 === 0 ? 1 : 0;
      d += ` A ${r} ${r} 0 0 ${sweep} ${xEnd} ${yNext}`;
    }
  }
  d += ` Q ${FINISH.x + 4} ${laneY(3, lane)} ${FINISH.x} ${FINISH.y}`;
  return d;
}

function EmblemMark({
  id,
  x,
  y,
  size,
  primary,
  secondary,
  opacity = 1,
}: {
  id: EmblemId;
  x: number;
  y: number;
  size: number;
  primary: string;
  secondary: string;
  opacity?: number;
}) {
  const emblem = EMBLEMS[id];
  const s = size / 100;
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${s}) translate(-50, -50)`}
      opacity={opacity}
      aria-hidden
    >
      {emblem.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          transform={p.transform}
          fill={p.role === "primary" ? primary : secondary}
        />
      ))}
    </g>
  );
}

// Incised lettering: a dark ghost copy offset above the light face copy
// reads as a V-cut carved into the wood.
function EngravedText({
  x,
  y,
  fontSize,
  letterSpacing,
  fill,
  fontFamily,
  children,
  opacity = 1,
}: {
  x: number;
  y: number;
  fontSize: number;
  letterSpacing: number;
  fill: string;
  fontFamily: string;
  children: string;
  opacity?: number;
}) {
  const common = {
    x,
    textAnchor: "middle" as const,
    fontSize,
    letterSpacing,
    style: { fontFamily },
  };
  return (
    <g opacity={opacity}>
      <text {...common} y={y - 0.7} fill="rgba(0,0,0,0.6)">
        {children}
      </text>
      <text {...common} y={y} fill={fill}>
        {children}
      </text>
    </g>
  );
}

function Motifs({ theme }: { theme: BoardTheme }) {
  const c1 = theme.accent;
  const c2 = theme.accent2;
  const bottom = 348;
  switch (theme.motif) {
    case "horns":
      // The crest silhouette and bottom emblem carry the theme.
      return null;
    case "waves":
      return (
        <g fill="none" strokeLinecap="round">
          <path
            d="M 60 322 Q 85 314 110 322 T 160 322 T 210 322 T 260 322 T 310 322 T 360 322"
            stroke={c1}
            strokeWidth="2"
            opacity="0.3"
          />
          <path
            d="M 85 332 Q 110 325 135 332 T 185 332 T 235 332 T 285 332 T 335 332"
            stroke={c2}
            strokeWidth="1.5"
            opacity="0.22"
          />
        </g>
      );
    case "vines":
      return (
        <g fill="none" strokeLinecap="round" opacity="0.4">
          {[
            undefined,
            `translate(${CENTER_X * 2},0) scale(-1,1)`,
            // bottom pair shifted inward, clear of the game hole and its label
            `translate(34,${bottom + 4}) scale(1,-1)`,
            `translate(${CENTER_X * 2 - 34},${bottom + 4}) scale(-1,-1)`,
          ].map((t, i) => (
            <g key={i} transform={t}>
              <path d="M 26 62 C 22 34 44 22 68 28 C 50 30 38 40 40 56" stroke={c2} strokeWidth="1.7" />
              <circle cx="66" cy="27" r="2" fill={c1} stroke="none" />
            </g>
          ))}
        </g>
      );
    case "snow":
      return (
        <g stroke={c2} strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
          {[
            { x: 36, y: 318, r: 7 },
            { x: 384, y: 322, r: 6 },
            { x: 34, y: 62, r: 5 },
            { x: 386, y: 58, r: 6 },
          ].map((f, i) => (
            <g key={i}>
              {[0, 60, 120].map((a) => {
                const rad = (a * Math.PI) / 180;
                const dx = Math.cos(rad) * f.r;
                const dy = Math.sin(rad) * f.r;
                return (
                  <line key={a} x1={f.x - dx} y1={f.y - dy} x2={f.x + dx} y2={f.y + dy} />
                );
              })}
            </g>
          ))}
        </g>
      );
    case "sun":
      return (
        <g stroke={c2} strokeWidth="1.3" strokeLinecap="round" opacity="0.3">
          <path d={`M 180 ${bottom - 8} A 30 30 0 0 1 240 ${bottom - 8}`} fill="none" />
          {Array.from({ length: 9 }).map((_, i) => {
            const a = Math.PI + (Math.PI * (i + 0.5)) / 9;
            const x1 = 210 + Math.cos(a) * 36;
            const y1 = bottom - 8 + Math.sin(a) * 36;
            const x2 = 210 + Math.cos(a) * 47;
            const y2 = bottom - 8 + Math.sin(a) * 47;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
      );
    case "mountains":
    case "diamonds":
    default:
      return (
        <g fill={theme.accent} opacity="0.4" stroke="none">
          {[128, 192, 256].map((y) => (
            <path key={y} d={`M 210 ${y - 5} L 215 ${y} L 210 ${y + 5} L 205 ${y} Z`} />
          ))}
        </g>
      );
  }
}

function Peg({
  x,
  y,
  color,
  gradientId,
  ghost,
}: {
  x: number;
  y: number;
  color: string;
  gradientId: string;
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
          <circle r="5.2" fill={`url(#${gradientId})`} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
          <circle cx="-1.5" cy="-1.7" r="1.5" fill="rgba(255,255,255,0.75)" />
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
  themeText = "",
  boardName = "",
}: {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Prev: number;
  player2Prev: number;
  themeText?: string;
  boardName?: string;
}) {
  const theme = useMemo(() => getBoardTheme(themeText), [themeText]);
  const shape = useMemo(() => getBoardShape(theme.shape, theme.seed), [theme]);
  const uid = `b${theme.seed % 100000}`;

  // Everything except the pegs is static per theme — memoize so score taps
  // don't rebuild ~250 hole circles.
  const staticBoard = useMemo(() => {
    const vb = shape.viewBox;
    const title = (boardName || "CRIBBAGE").toUpperCase();
    const titleSize = Math.max(
      7,
      Math.min(11, (shape.plaque.w - 44) / (title.length * 0.72))
    );

    const holes: JSX.Element[] = [];
    for (const lane of [0, 1] as const) {
      // two start holes per lane
      for (const sx of [START_X, START_X2]) {
        holes.push(
          <circle key={`s${lane}-${sx}`} cx={sx} cy={laneY(0, lane)} r="2.5" fill="#160B07" />
        );
      }
      for (let score = 1; score <= 120; score++) {
        const { x, y } = holeXY(score, lane);
        holes.push(<circle key={`${lane}-${score}`} cx={x} cy={y} r="2.5" fill="#160B07" />);
      }
    }

    const numbers = [15, 30, 45, 60, 75, 90, 105, 120].map((score) => {
      const street = Math.floor((score - 1) / HOLES_PER_STREET);
      const { x } = holeXY(score, 0);
      return (
        <text
          key={score}
          x={x}
          y={STREET_Y[street] + 19}
          textAnchor="middle"
          fontSize="6.5"
          fill="rgba(237,228,211,0.4)"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {score}
        </text>
      );
    });

    const markers = SKUNK_MARKERS.map((m) => {
      const street = Math.floor((m.score - 1) / HOLES_PER_STREET);
      const { x } = holeXY(m.score, 0);
      const yMid = STREET_Y[street];
      return (
        <g key={m.score}>
          <line
            x1={x}
            y1={yMid - 16}
            x2={x}
            y2={yMid + 16}
            stroke={m.color}
            strokeWidth="1.2"
            strokeDasharray="2 2.5"
            opacity="0.65"
          />
          {([0, 1] as const).map((lane) => {
            const p = holeXY(m.score, lane);
            return (
              <circle
                key={lane}
                cx={p.x}
                cy={p.y}
                r="4.8"
                fill="none"
                stroke={m.color}
                strokeWidth="1.4"
                opacity="0.9"
              />
            );
          })}
          <text
            x={x}
            y={yMid + 27}
            textAnchor="middle"
            fontSize="5.5"
            letterSpacing="1"
            fill={m.color}
            opacity="0.85"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {m.label}
          </text>
        </g>
      );
    });

    return (
      <>
        {/* wood face + dark rail rim */}
        <path
          d={shape.outline}
          fill={`url(#wood-${uid})`}
          stroke={theme.wood.rail}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        <g clipPath={`url(#clip-${uid})`}>
          {/* grain + vignette, sized to the shape's canvas */}
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} filter={`url(#grain-${uid})`} opacity="0.35" />
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#vignette-${uid})`} />

          {/* routed-edge recess: the clip discards the outer half of this
              blurred stroke, leaving a soft inner shadow hugging the rim */}
          <path
            d={shape.outline}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth="9"
            filter={`url(#edgeblur-${uid})`}
          />
          {/* roundover highlight: nudged down so light catches only
              top-facing edges */}
          <path
            d={shape.outline}
            fill="none"
            stroke="rgba(255,236,200,0.22)"
            strokeWidth="2.5"
            transform="translate(0, 1.6)"
          />

          {/* surfboard stringer seam */}
          {theme.shape === "longboard" && (
            <line
              x1={vb.x}
              y1="178"
              x2={vb.x + vb.w}
              y2="178"
              stroke="rgba(237,228,211,0.14)"
              strokeWidth="1.5"
            />
          )}

          {/* watermark emblem inlay */}
          <EmblemMark
            id={theme.emblem}
            x={shape.watermark.x}
            y={shape.watermark.y}
            size={shape.watermark.size}
            primary="rgba(237,228,211,1)"
            secondary="rgba(237,228,211,0.7)"
            opacity={0.06}
          />

          <Motifs theme={theme} />
        </g>

        {/* stringing inlay lines — crisp, outside the clip */}
        <path d={shape.stringing} fill="none" stroke={theme.accent} strokeWidth="1.1" opacity="0.5" />
        {shape.stringing2 && (
          <path d={shape.stringing2} fill="none" stroke={theme.accent2} strokeWidth="0.6" opacity="0.3" />
        )}

        {/* brass rosettes */}
        {shape.accents.map((a, i) => {
          const slotAngle = ((theme.seed >> (i * 3)) % 180) - 90;
          return (
            <g key={i} transform={`translate(${a.x}, ${a.y})`}>
              <circle r="6" fill="none" stroke={`url(#brass-${uid})`} strokeWidth="0.7" opacity="0.7" />
              <circle r="4" fill={`url(#screw-${uid})`} />
              <line
                x1="-2.6"
                y1="0"
                x2="2.6"
                y2="0"
                transform={`rotate(${slotAngle})`}
                stroke="rgba(0,0,0,0.55)"
                strokeWidth="0.9"
              />
            </g>
          );
        })}

        {/* brass-framed name plaque */}
        <g>
          <rect
            x={shape.plaque.x}
            y={shape.plaque.y}
            width={shape.plaque.w}
            height={shape.plaque.h}
            rx="4"
            fill="rgba(0,0,0,0.3)"
            stroke={`url(#brass-${uid})`}
            strokeWidth="1.6"
          />
          <rect
            x={shape.plaque.x + 3}
            y={shape.plaque.y + 3}
            width={shape.plaque.w - 6}
            height={shape.plaque.h - 6}
            rx="2.5"
            fill="none"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="0.8"
          />
          {/* corner pins */}
          {[
            [shape.plaque.x + 5, shape.plaque.y + 5],
            [shape.plaque.x + shape.plaque.w - 5, shape.plaque.y + 5],
            [shape.plaque.x + 5, shape.plaque.y + shape.plaque.h - 5],
            [shape.plaque.x + shape.plaque.w - 5, shape.plaque.y + shape.plaque.h - 5],
          ].map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r="1.2" fill={`url(#brass-${uid})`} />
          ))}
          <EngravedText
            x={shape.plaque.x + shape.plaque.w / 2}
            y={shape.plaque.y + shape.plaque.h / 2 + 1}
            fontSize={titleSize}
            letterSpacing={2}
            fill="#EDE4D3"
            fontFamily="var(--font-fraunces), serif"
            opacity={0.92}
          >
            {title}
          </EngravedText>
          <EngravedText
            x={shape.plaque.x + shape.plaque.w / 2}
            y={shape.plaque.y + shape.plaque.h - 5}
            fontSize={5}
            letterSpacing={3}
            fill={theme.accent2}
            fontFamily="var(--font-inter), sans-serif"
            opacity={0.7}
          >
            {`${WINNING_SCORE} TO WIN`}
          </EngravedText>
          {shape.plaque.flanks ? (
            <>
              <EmblemMark
                id={theme.emblem}
                x={shape.plaque.x + 16}
                y={shape.plaque.y + shape.plaque.h / 2}
                size={15}
                primary={theme.accent}
                secondary={theme.accent2}
                opacity={0.85}
              />
              <EmblemMark
                id={theme.emblem}
                x={shape.plaque.x + shape.plaque.w - 16}
                y={shape.plaque.y + shape.plaque.h / 2}
                size={15}
                primary={theme.accent}
                secondary={theme.accent2}
                opacity={0.85}
              />
            </>
          ) : (
            // no flanking room: a single maker's-mark emblem elsewhere
            <EmblemMark
              id={theme.emblem}
              x={shape.emblemSpot?.x ?? CENTER_X}
              y={shape.emblemSpot?.y ?? shape.plaque.y - 14}
              size={shape.emblemSpot?.size ?? 20}
              primary={theme.accent}
              secondary={theme.accent2}
              opacity={0.85}
            />
          )}
        </g>

        {/* track layer, clipped as a safety net */}
        <g clipPath={`url(#clip-${uid})`}>
          {([0, 1] as const).map((lane) => (
            <path
              key={lane}
              d={lanePath(lane)}
              fill="none"
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="9"
              strokeLinecap="round"
            />
          ))}

          {holes}
          {numbers}
          {markers}

          <text
            x={(START_X + START_X2) / 2}
            y="74"
            textAnchor="middle"
            fontSize="6"
            letterSpacing="1.5"
            fill="rgba(237,228,211,0.5)"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            START
          </text>

          {/* shared game hole at 121 with a brass ring */}
          <circle cx={FINISH.x} cy={FINISH.y} r="9" fill={theme.wood.deep} stroke={`url(#brass-${uid})`} strokeWidth="2" />
          <circle cx={FINISH.x} cy={FINISH.y} r="5.6" fill="none" stroke={theme.accent} strokeWidth="0.7" opacity="0.6" />
          <circle cx={FINISH.x} cy={FINISH.y} r="2.8" fill="#160B07" />
          <text
            x={FINISH.x}
            y={FINISH.y + 19}
            textAnchor="middle"
            fontSize="6"
            fill={theme.accent}
            opacity="0.9"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            {WINNING_SCORE}
          </text>
        </g>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, shape, boardName, uid]);

  const p1 = holeXY(player1Score, 0);
  const p2 = holeXY(player2Score, 1);
  const g1 = holeXY(player1Prev, 0);
  const g2 = holeXY(player2Prev, 1);

  const players = [
    { name: player1Name, score: player1Score, peg: theme.peg1 },
    { name: player2Name, score: player2Score, peg: theme.peg2 },
  ];

  return (
    <div className="w-full">
      {/* score plaques */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {players.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between rounded-lg px-3 py-1.5"
            style={{
              backgroundColor: "rgba(0,0,0,0.25)",
              border: `1px solid ${theme.accent}55`,
            }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.peg, boxShadow: `0 0 5px ${p.peg}` }}
              />
              <span className="text-xs uppercase tracking-[0.15em] text-brass-light/80 truncate">
                {p.name}
              </span>
            </span>
            <span className="font-score text-lg text-track">{p.score}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`${shape.viewBox.x} ${shape.viewBox.y} ${shape.viewBox.w} ${shape.viewBox.h}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Cribbage board: ${player1Name} ${player1Score}, ${player2Name} ${player2Score}`}
        style={{ filter: `drop-shadow(0 4px 14px rgba(0,0,0,0.5)) drop-shadow(0 0 20px ${theme.glow})` }}
      >
        <defs>
          <clipPath id={`clip-${uid}`}>
            <path d={shape.outline} />
          </clipPath>
          <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={theme.wood.light} />
            <stop offset="0.5" stopColor={theme.wood.mid} />
            <stop offset="1" stopColor={theme.wood.deep} />
          </linearGradient>
          <radialGradient id={`vignette-${uid}`} cx="0.5" cy="0.35" r="0.9">
            <stop offset="0.55" stopColor="rgba(0,0,0,0)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
          <radialGradient id={`screw-${uid}`} cx="0.35" cy="0.3" r="1">
            <stop offset="0" stopColor="#E8D2A0" />
            <stop offset="0.7" stopColor="#8A6A3A" />
            <stop offset="1" stopColor="#4A3820" />
          </radialGradient>
          <linearGradient id={`brass-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E8D2A0" />
            <stop offset="0.5" stopColor="#B08D57" />
            <stop offset="1" stopColor="#6E522C" />
          </linearGradient>
          <filter id={`edgeblur-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          {/* horizontally-stretched fractal noise reads as wood grain */}
          <filter id={`grain-${uid}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.12"
              numOctaves="3"
              seed={theme.seed % 1000}
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.5 0.5 0.5 0 0"
            />
          </filter>
          <radialGradient id={`peg1-${uid}`} cx="0.32" cy="0.28" r="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="0.3" stopColor={theme.peg1} />
            <stop offset="0.75" stopColor={theme.peg1} />
            <stop offset="1" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
          <radialGradient id={`peg2-${uid}`} cx="0.32" cy="0.28" r="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="0.3" stopColor={theme.peg2} />
            <stop offset="0.75" stopColor={theme.peg2} />
            <stop offset="1" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>

        {staticBoard}

        {/* ghost (previous) pegs — the classic leap-frog reference */}
        <Peg x={g1.x} y={g1.y} color={theme.peg1} gradientId={`peg1-${uid}`} ghost />
        <Peg x={g2.x} y={g2.y} color={theme.peg2} gradientId={`peg2-${uid}`} ghost />
        <Peg x={p1.x} y={p1.y} color={theme.peg1} gradientId={`peg1-${uid}`} />
        <Peg x={p2.x} y={p2.y} color={theme.peg2} gradientId={`peg2-${uid}`} />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[10px] uppercase tracking-widest text-track/50">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full border"
            style={{ borderColor: theme.accent }}
          />
          Game hole ({WINNING_SCORE})
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#D4A72C", boxShadow: "0 0 4px #D4A72C" }}
          />
          Skunk ({SKUNK_THRESHOLD})
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#C1432A", boxShadow: "0 0 4px #C1432A" }}
          />
          Dbl skunk ({DOUBLE_SKUNK_THRESHOLD})
        </span>
      </div>
    </div>
  );
}
