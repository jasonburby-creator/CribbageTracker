// Hand-drawn vector emblems rendered as wood/brass inlays on the board.
// All are filled silhouettes in a 100×100 design space centered on (50,50),
// so one transform renders any size. `role` maps to theme colors:
// primary → accent, secondary → accent2.

import type { EmblemId } from "./theme";

export type EmblemPath = {
  d: string;
  role: "primary" | "secondary";
  transform?: string;
};

export type Emblem = { paths: EmblemPath[] };

function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
}

// One barbed spoke of a snowflake, pointing up from center; rotated 6×.
const SNOWFLAKE_SPOKE =
  "M 48.6 50 L 48.6 9 L 51.4 9 L 51.4 50 Z " +
  "M 50 17 L 43 9.5 L 45.2 7.4 L 50 12.6 L 54.8 7.4 L 57 9.5 Z " +
  "M 50 31 L 41 22 L 43.2 19.8 L 50 26.4 L 56.8 19.8 L 59 22 Z";

// Sun: central disc + 12 tapered rays, generated once at module load.
function sunPath(): string {
  let d = circle(50, 50, 15);
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const a = (i * 2 * Math.PI) / rays;
    const perp = a + Math.PI / 2;
    const bx = 50 + Math.cos(a) * 21;
    const by = 50 + Math.sin(a) * 21;
    const tx = 50 + Math.cos(a) * 44;
    const ty = 50 + Math.sin(a) * 44;
    const wx = Math.cos(perp) * 3.2;
    const wy = Math.sin(perp) * 3.2;
    d += ` M ${(bx - wx).toFixed(1)} ${(by - wy).toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${(bx + wx).toFixed(1)} ${(by + wy).toFixed(1)} Z`;
  }
  return d;
}

export const EMBLEMS: Record<EmblemId, Emblem> = {
  bullHead: {
    paths: [
      {
        // head + brow, horns as outward crescents
        d:
          "M 32 38 C 30 58 36 76 50 88 C 64 76 70 58 68 38 C 62 33 38 33 32 38 Z " +
          "M 34 36 C 20 34 8 24 6 8 C 17 20 27 26 38 28 C 36 30.5 35 33 34 36 Z " +
          "M 66 36 C 80 34 92 24 94 8 C 83 20 73 26 62 28 C 64 30.5 65 33 66 36 Z",
        role: "primary",
      },
      {
        d: circle(43, 72, 3) + " " + circle(57, 72, 3),
        role: "secondary",
      },
    ],
  },
  wave: {
    paths: [
      {
        // breaking crest curling over itself
        d: "M 6 78 C 4 48 22 28 50 26 C 70 25 86 36 90 54 C 80 44 66 42 58 48 C 68 50 74 58 74 68 C 64 60 54 60 48 66 C 56 68 60 72 60 78 Z",
        role: "primary",
      },
      {
        d: "M 64 78 C 72 70 84 68 96 73 L 96 78 Z M 4 84 C 20 80 36 80 52 84 Z",
        role: "secondary",
      },
    ],
  },
  mountain: {
    paths: [
      {
        d: "M 4 82 L 36 26 L 50 48 L 66 18 L 96 82 Z",
        role: "primary",
      },
      {
        // snowcap on the tall peak
        d: "M 58 33 L 66 18 L 74 33 L 69 29 L 66 35 L 63 29 Z",
        role: "secondary",
      },
    ],
  },
  grapes: {
    paths: [
      {
        d: [
          circle(36, 48, 9),
          circle(50, 46, 9),
          circle(64, 48, 9),
          circle(43, 62, 9),
          circle(57, 62, 9),
          circle(50, 76, 9),
        ].join(" "),
        role: "primary",
      },
      {
        // leaf + stem curl
        d:
          "M 48 36 C 40 22 26 18 16 24 C 24 36 38 40 48 36 Z " +
          "M 49 38 C 49 30 51 25 56 18 L 59 20 C 54 27 52 32 52 38 Z",
        role: "secondary",
      },
    ],
  },
  snowflake: {
    paths: [0, 60, 120, 180, 240, 300].map((a) => ({
      d: SNOWFLAKE_SPOKE,
      role: "primary" as const,
      transform: a === 0 ? undefined : `rotate(${a} 50 50)`,
    })),
  },
  sun: {
    paths: [{ d: sunPath(), role: "primary" }],
  },
  pine: {
    paths: [
      {
        d: "M 50 6 L 72 34 L 62 34 L 80 58 L 68 58 L 86 82 L 14 82 L 32 58 L 20 58 L 38 34 L 28 34 Z",
        role: "primary",
      },
      {
        d: "M 45 82 L 55 82 L 55 94 L 45 94 Z",
        role: "secondary",
      },
    ],
  },
  cardPip: {
    paths: [
      {
        // classic spade
        d: "M 50 10 C 34 34 16 44 16 60 C 16 72 26 78 36 74 C 42 72 46 68 47 63 C 45 76 41 84 34 90 L 66 90 C 59 84 55 76 53 63 C 54 68 58 72 64 74 C 74 78 84 72 84 60 C 84 44 66 34 50 10 Z",
        role: "primary",
      },
    ],
  },
  fleurDeLis: {
    paths: [
      {
        d:
          "M 50 4 C 41 17 39 30 44 43 L 56 43 C 61 30 59 17 50 4 Z " +
          "M 43 47 C 30 38 17 40 13 52 C 11 63 20 69 30 66 C 38 64 42 57 43 51 Z " +
          "M 57 47 C 70 38 83 40 87 52 C 89 63 80 69 70 66 C 62 64 58 57 57 51 Z " +
          "M 42 74 L 58 74 C 56 82 56 88 58 96 L 42 96 C 44 88 44 82 42 74 Z",
        role: "primary",
      },
      {
        d: "M 38 67 L 62 67 L 62 72 L 38 72 Z",
        role: "secondary",
      },
    ],
  },
  fish: {
    paths: [
      {
        d:
          "M 10 50 C 22 32 40 25 56 28 C 70 31 79 40 82 50 C 79 60 70 69 56 72 C 40 75 22 68 10 50 Z " +
          "M 80 50 L 94 36 L 90 50 L 94 64 Z",
        role: "primary",
      },
      {
        d: circle(27, 45, 2.8),
        role: "secondary",
      },
    ],
  },
};
