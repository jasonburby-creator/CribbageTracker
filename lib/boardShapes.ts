// Board silhouette generators. Each shape returns the outline path, a
// hand-inset "stringing" inlay path (emitted from the same control points —
// never scaled, which distorts concave regions), plaque/watermark placement,
// and brass rosette anchors.
//
// Every outline must contain the track envelope (in track coordinates, which
// never move): groove arcs to x≈2.5 left / x≈417 right, streets y 84–300,
// START label (x 10–36, y 68–76), DBL SKUNK label (~x 340–405, y 310–318),
// game hole + label (x 13–31, y 279–307).

import type { ShapeId } from "./theme";

export type BoardShape = {
  viewBox: { x: number; y: number; w: number; h: number };
  outline: string;
  stringing: string;
  stringing2?: string;
  plaque: { x: number; y: number; w: number; h: number; flanks: boolean };
  watermark: { x: number; y: number; size: number };
  accents: { x: number; y: number }[];
  // where to set the single emblem when the plaque has no flanking room
  emblemSpot?: { x: number; y: number; size: number };
};

// Classic plank: straight edges bowed ~3px, corner family varies by seed.
function plank(seed: number): BoardShape {
  const family = seed % 3; // 0 = ogee, 1 = chamfer, 2 = thumbnail
  function body(m: number, bow: number): string {
    const L = -6 + m;
    const R = 426 - m;
    const T = 4 + m;
    const B = 348 - m;
    const k = Math.max(24 - m * 0.5, 10); // corner extent
    // corner segments, clockwise
    const tr =
      family === 0
        ? `A 16 16 0 0 1 ${R - k + 16} ${T + 7} A 7 7 0 0 0 ${R} ${T + k}`
        : family === 1
        ? `L ${R} ${T + k}`
        : `A ${k} ${k} 0 0 1 ${R} ${T + k}`;
    const br =
      family === 0
        ? `A 16 16 0 0 1 ${R - 7} ${B - k + 16} A 7 7 0 0 0 ${R - k} ${B}`
        : family === 1
        ? `L ${R - k} ${B}`
        : `A ${k} ${k} 0 0 1 ${R - k} ${B}`;
    const bl =
      family === 0
        ? `A 16 16 0 0 1 ${L + k - 16} ${B - 7} A 7 7 0 0 0 ${L} ${B - k}`
        : family === 1
        ? `L ${L} ${B - k}`
        : `A ${k} ${k} 0 0 1 ${L} ${B - k}`;
    const tl =
      family === 0
        ? `A 16 16 0 0 1 ${L + 7} ${T + k - 16} A 7 7 0 0 0 ${L + k} ${T}`
        : family === 1
        ? `L ${L + k} ${T}`
        : `A ${k} ${k} 0 0 1 ${L + k} ${T}`;
    return (
      `M ${L + k} ${T} Q 210 ${T - bow} ${R - k} ${T} ${tr}` +
      ` L ${R} ${B - k} ${br}` +
      ` Q 210 ${B + bow} ${L + k} ${B} ${bl}` +
      ` L ${L} ${T + k} ${tl} Z`
    );
  }
  return {
    viewBox: { x: -10, y: -2, w: 440, h: 356 },
    outline: body(0, 3),
    stringing: body(11, 2),
    plaque: { x: 120, y: 16, w: 180, h: 32, flanks: true },
    watermark: { x: 210, y: 200, size: 150 },
    accents: [
      { x: 14, y: 24 },
      { x: 406, y: 24 },
      { x: 14, y: 328 },
      { x: 406, y: 328 },
    ],
  };
}

// Bull-horn crest: plank body whose whole top edge is a pair of horns —
// pointed tips at the outer corners, one long concave sweep down to a low
// center saddle over the plaque. Mirrored about x = 210 (hand-mirrored).
function crest(): BoardShape {
  const outline =
    "M -6 96" +
    " C -10 40 -6 0 18 -16" + // outer edge rising to the left horn tip
    " C 60 -8 120 24 210 38" + // long inner sweep down to center saddle
    " C 300 24 360 -8 402 -16" + // mirror: sweep up to right horn tip
    " C 426 0 430 40 426 96" + // mirror: outer edge down the right side
    " L 426 328 A 20 20 0 0 1 406 348" +
    " L 14 348 A 20 20 0 0 1 -6 328 Z";
  const stringing =
    "M 5 100" +
    " C 1 46 6 8 22 -4" +
    " C 62 3 126 34 210 47" +
    " C 294 34 358 3 398 -4" +
    " C 414 8 419 46 415 100" +
    " L 415 322 Q 415 337 400 337" +
    " L 20 337 Q 5 337 5 322 Z";
  return {
    viewBox: { x: -10, y: -26, w: 440, h: 382 },
    outline,
    stringing,
    plaque: { x: 140, y: 52, w: 140, h: 26, flanks: false },
    watermark: { x: 210, y: 205, size: 150 },
    accents: [
      { x: 14, y: 330 },
      { x: 406, y: 330 },
      { x: 12, y: 100 },
      { x: 408, y: 100 },
    ],
    emblemSpot: { x: 210, y: 324, size: 22 },
  };
}

// Longboard deck: semicircular-ellipse end caps joined by bowed rails, with
// a surfboard stringer seam rendered by the component.
function longboard(): BoardShape {
  const outline =
    "M 46 8 Q 210 0 374 8" +
    " A 58 170 0 0 1 374 348" +
    " Q 210 354 46 348" +
    " A 58 170 0 0 1 46 8 Z";
  const stringing =
    "M 52 19 Q 210 12 368 19" +
    " A 47 159 0 0 1 368 337" +
    " Q 210 343 52 337" +
    " A 47 159 0 0 1 52 19 Z";
  return {
    viewBox: { x: -14, y: -4, w: 448, h: 364 },
    outline,
    stringing,
    plaque: { x: 122, y: 20, w: 176, h: 32, flanks: true },
    watermark: { x: 210, y: 200, size: 150 },
    accents: [
      { x: 96, y: 26 },
      { x: 324, y: 26 },
      { x: 96, y: 330 },
      { x: 324, y: 330 },
    ],
  };
}

// Summit ridge: all straight facets — chamfered bottom corners, a faceted
// pediment with a central summit and minor side peaks.
function ridge(): BoardShape {
  const outline =
    "M -6 30 L 14 12 L 58 12 L 84 -2 L 110 12 L 148 12" +
    " L 176 -8 L 210 -20 L 244 -8 L 272 12" +
    " L 310 12 L 336 -2 L 362 12 L 406 12 L 426 30" +
    " L 426 330 L 408 348 L 12 348 L -6 330 Z";
  const stringing =
    "M 5 34 L 20 21 L 60 21 L 86 7 L 112 21 L 152 21" +
    " L 180 1 L 210 -9 L 240 1 L 268 21" +
    " L 308 21 L 334 7 L 360 21 L 400 21 L 415 34" +
    " L 415 325 L 403 337 L 17 337 L 5 325 Z";
  return {
    viewBox: { x: -10, y: -22, w: 440, h: 378 },
    outline,
    stringing,
    plaque: { x: 130, y: 26, w: 160, h: 30, flanks: true },
    watermark: { x: 210, y: 200, size: 150 },
    accents: [
      { x: 14, y: 36 },
      { x: 406, y: 36 },
      { x: 16, y: 332 },
      { x: 404, y: 332 },
    ],
  };
}

export function getBoardShape(id: ShapeId, seed: number): BoardShape {
  switch (id) {
    case "crest":
      return crest();
    case "longboard":
      return longboard();
    case "ridge":
      return ridge();
    case "plank":
    default:
      return plank(seed);
  }
}
