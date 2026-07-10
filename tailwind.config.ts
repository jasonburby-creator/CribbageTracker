import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS variables so light/dark themes swap
        // without editing any classNames. Variables are RGB triplets defined
        // in globals.css; the `<alpha-value>` form keeps opacity modifiers
        // (e.g. text-brass-light/70) working.
        walnut: {
          DEFAULT: "rgb(var(--c-surface) / <alpha-value>)",
          light: "rgb(var(--c-surface) / <alpha-value>)",
          deep: "rgb(var(--c-bg) / <alpha-value>)",
        },
        track: "rgb(var(--c-text) / <alpha-value>)",
        brass: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          light: "rgb(var(--c-muted) / <alpha-value>)",
        },
        // Dark text that sits on top of the accent color (orange buttons);
        // stays dark in both themes.
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        felt: "#2F5233",
        skunk: "rgb(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        score: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
