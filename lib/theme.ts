// Deterministic board theming. The trip name / board name / board theme text
// is keyword-matched against curated looks (palette, wood, silhouette,
// emblem, motif, pegs), and hashed so that trips with no keyword match still
// get a stable, distinctive board rather than a generic default.

export type Motif =
  | "horns"
  | "waves"
  | "mountains"
  | "vines"
  | "snow"
  | "sun"
  | "diamonds";

// Board silhouette families — implemented in lib/boardShapes.ts.
export type ShapeId = "plank" | "crest" | "longboard" | "ridge";

// Inlaid vector emblems — implemented in lib/emblems.ts.
export type EmblemId =
  | "bullHead"
  | "wave"
  | "mountain"
  | "grapes"
  | "snowflake"
  | "sun"
  | "pine"
  | "cardPip"
  | "fleurDeLis"
  | "fish";

export type Wood = {
  light: string;
  mid: string;
  deep: string;
  rail: string;
};

export type BoardTheme = {
  emblem: EmblemId;
  shape: ShapeId;
  accent: string; // stringing inlay, medallion, primary details
  accent2: string; // motif strokes, secondary details
  glow: string;
  wood: Wood;
  peg1: string;
  peg2: string;
  motif: Motif;
  seed: number; // stable per-text; drives grain + plank corner family
};

const WOODS = {
  walnut: { light: "#5A3826", mid: "#4A2E22", deep: "#332016", rail: "#241410" },
  chestnut: { light: "#6B3F24", mid: "#57301B", deep: "#3C1F12", rail: "#2A140C" },
  teak: { light: "#8A6238", mid: "#6E4A28", deep: "#4C2F18", rail: "#33210F" },
  mahogany: { light: "#5C2B22", mid: "#48211B", deep: "#331511", rail: "#240F0C" },
  cherry: { light: "#6E3226", mid: "#57261D", deep: "#3D1812", rail: "#29100C" },
  ash: { light: "#7C6A52", mid: "#63543F", deep: "#463A2A", rail: "#30281C" },
  pine: { light: "#5E4426", mid: "#4B351E", deep: "#342414", rail: "#241A0E" },
  mesquite: { light: "#77462A", mid: "#5F361F", deep: "#422413", rail: "#2C190D" },
} satisfies Record<string, Wood>;

type CuratedTheme = {
  keywords: string[];
  emblem: EmblemId;
  shape: ShapeId;
  accent: string;
  accent2: string;
  wood: Wood;
  peg1: string;
  peg2: string;
  motif: Motif;
};

// Ordered most-specific first: the first match sets the base look, and a
// second match (e.g. "bulls" + "spain") lends its accent as the secondary.
const THEMES: CuratedTheme[] = [
  {
    keywords: ["bull", "bulls", "pamplona", "encierro", "fermin", "toro"],
    emblem: "bullHead",
    shape: "crest",
    accent: "#C1432A",
    accent2: "#D4A72C",
    wood: WOODS.chestnut,
    peg1: "#D94F35",
    peg2: "#E8B33C",
    motif: "horns",
  },
  {
    keywords: ["spain", "spanish", "flamenco", "paella", "madrid", "sevilla", "barcelona", "sebastian", "sebastián"],
    emblem: "sun",
    shape: "plank",
    accent: "#D4A72C",
    accent2: "#C1432A",
    wood: WOODS.chestnut,
    peg1: "#E8B33C",
    peg2: "#D94F35",
    motif: "sun",
  },
  {
    keywords: ["beach", "coast", "surf", "ocean", "sea", "island"],
    emblem: "wave",
    shape: "longboard",
    accent: "#3E8E8A",
    accent2: "#7FC4BE",
    wood: WOODS.teak,
    peg1: "#E8D6A8",
    peg2: "#4FA9A2",
    motif: "waves",
  },
  {
    keywords: ["mountain", "alps", "hike", "hiking", "peak", "trail"],
    emblem: "mountain",
    shape: "ridge",
    accent: "#4C7A4C",
    accent2: "#A8C0A8",
    wood: WOODS.pine,
    peg1: "#D4B483",
    peg2: "#6E8F6E",
    motif: "diamonds",
  },
  {
    keywords: ["wine", "vineyard", "tuscany", "napa"],
    emblem: "grapes",
    shape: "plank",
    accent: "#6E2A3A",
    accent2: "#C99A5B",
    wood: WOODS.mahogany,
    peg1: "#C05C74",
    peg2: "#D4B483",
    motif: "vines",
  },
  {
    keywords: ["desert", "arizona", "cactus"],
    emblem: "sun",
    shape: "plank",
    accent: "#B8722E",
    accent2: "#7A9E63",
    wood: WOODS.mesquite,
    peg1: "#E0A05C",
    peg2: "#8FAF74",
    motif: "sun",
  },
  {
    keywords: ["snow", "ski", "alpine", "winter"],
    emblem: "snowflake",
    shape: "ridge",
    accent: "#5B87A6",
    accent2: "#C9D8E4",
    wood: WOODS.ash,
    peg1: "#9FC0D8",
    peg2: "#D4B483",
    motif: "snow",
  },
  {
    keywords: ["italy", "italian", "roma", "venice"],
    emblem: "grapes",
    shape: "plank",
    accent: "#4C7A4C",
    accent2: "#C1432A",
    wood: WOODS.walnut,
    peg1: "#6FA06F",
    peg2: "#D05848",
    motif: "vines",
  },
  {
    keywords: ["france", "french", "paris"],
    emblem: "fleurDeLis",
    shape: "plank",
    accent: "#3E5C8A",
    accent2: "#C9CBD8",
    wood: WOODS.walnut,
    peg1: "#7C96C0",
    peg2: "#D4B483",
    motif: "vines",
  },
  {
    keywords: ["japan", "tokyo", "sushi"],
    emblem: "wave",
    shape: "longboard",
    accent: "#A6414A",
    accent2: "#E8DCC8",
    wood: WOODS.cherry,
    peg1: "#D87880",
    peg2: "#8FA8B8",
    motif: "waves",
  },
  {
    keywords: ["golf"],
    emblem: "cardPip",
    shape: "plank",
    accent: "#4C7A4C",
    accent2: "#E8E2D2",
    wood: WOODS.pine,
    peg1: "#7FB07F",
    peg2: "#E8E2D2",
    motif: "diamonds",
  },
  {
    keywords: ["fish", "fishing", "lake", "river"],
    emblem: "fish",
    shape: "longboard",
    accent: "#3E8E8A",
    accent2: "#B8722E",
    wood: WOODS.teak,
    peg1: "#4FA9A2",
    peg2: "#D89A5C",
    motif: "waves",
  },
];

const FALLBACK_WOODS: Wood[] = [
  WOODS.walnut,
  WOODS.chestnut,
  WOODS.teak,
  WOODS.mahogany,
  WOODS.cherry,
  WOODS.pine,
];

const FALLBACK_MOTIFS: Motif[] = ["diamonds", "vines", "sun"];
const FALLBACK_EMBLEMS: EmblemId[] = ["cardPip", "sun"];

function hashText(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getBoardTheme(text: string): BoardTheme {
  const lower = text.toLowerCase();
  const seed = hashText(lower);

  const matches = THEMES.filter((t) =>
    t.keywords.some((kw) => lower.includes(kw))
  );

  if (matches.length > 0) {
    const base = matches[0];
    const accent2 =
      matches.length > 1 && matches[1].accent !== base.accent
        ? matches[1].accent
        : base.accent2;
    return {
      emblem: base.emblem,
      shape: base.shape,
      accent: base.accent,
      accent2,
      glow: hexToRgba(base.accent, 0.3),
      wood: base.wood,
      peg1: base.peg1,
      peg2: base.peg2,
      motif: base.motif,
      seed,
    };
  }

  const hue = seed % 360;
  return {
    emblem: FALLBACK_EMBLEMS[seed % FALLBACK_EMBLEMS.length],
    shape: "plank",
    accent: `hsl(${hue} 42% 56%)`,
    accent2: `hsl(${(hue + 40) % 360} 38% 62%)`,
    glow: `hsl(${hue} 42% 56% / 0.3)`,
    wood: FALLBACK_WOODS[seed % FALLBACK_WOODS.length],
    peg1: "#D4B483",
    peg2: "#7FA6A0",
    motif: FALLBACK_MOTIFS[seed % FALLBACK_MOTIFS.length],
    seed,
  };
}
