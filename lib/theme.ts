export type ThemeAccent = {
  icon: string;
  color: string; // peg/accent color
  glow: string; // border glow color
};

const THEMES: { keywords: string[]; accent: ThemeAccent }[] = [
  {
    keywords: ["bull", "bulls", "pamplona", "encierro", "fermin"],
    accent: { icon: "🐂", color: "#C1432A", glow: "rgba(193,67,42,0.35)" },
  },
  {
    keywords: ["spain", "spanish", "flamenco", "paella", "madrid", "sevilla", "barcelona"],
    accent: { icon: "🇪🇸", color: "#D4A72C", glow: "rgba(212,167,44,0.35)" },
  },
  {
    keywords: ["beach", "coast", "surf", "ocean", "sea", "island"],
    accent: { icon: "🌊", color: "#3E8E8A", glow: "rgba(62,142,138,0.35)" },
  },
  {
    keywords: ["mountain", "alps", "hike", "hiking", "peak", "trail"],
    accent: { icon: "⛰️", color: "#4C7A4C", glow: "rgba(76,122,76,0.35)" },
  },
  {
    keywords: ["wine", "vineyard", "tuscany", "napa"],
    accent: { icon: "🍷", color: "#6E2A3A", glow: "rgba(110,42,58,0.35)" },
  },
  {
    keywords: ["desert", "arizona", "cactus"],
    accent: { icon: "🌵", color: "#B8722E", glow: "rgba(184,114,46,0.35)" },
  },
  {
    keywords: ["snow", "ski", "alpine", "winter"],
    accent: { icon: "❄️", color: "#5B87A6", glow: "rgba(91,135,166,0.35)" },
  },
  {
    keywords: ["italy", "italian", "roma", "venice"],
    accent: { icon: "🍝", color: "#4C7A4C", glow: "rgba(76,122,76,0.35)" },
  },
  {
    keywords: ["france", "french", "paris"],
    accent: { icon: "🥖", color: "#3E5C8A", glow: "rgba(62,92,138,0.35)" },
  },
  {
    keywords: ["japan", "tokyo", "sushi"],
    accent: { icon: "🎏", color: "#A6414A", glow: "rgba(166,65,74,0.35)" },
  },
  {
    keywords: ["golf"],
    accent: { icon: "⛳", color: "#4C7A4C", glow: "rgba(76,122,76,0.35)" },
  },
  {
    keywords: ["fish", "fishing", "lake", "river"],
    accent: { icon: "🎣", color: "#3E8E8A", glow: "rgba(62,142,138,0.35)" },
  },
];

const DEFAULT_ACCENT: ThemeAccent = {
  icon: "🃏",
  color: "#B08D57",
  glow: "rgba(176,141,87,0.35)",
};

export function getThemeAccent(text: string): ThemeAccent {
  const lower = text.toLowerCase();
  for (const theme of THEMES) {
    if (theme.keywords.some((kw) => lower.includes(kw))) {
      return theme.accent;
    }
  }
  return DEFAULT_ACCENT;
}
