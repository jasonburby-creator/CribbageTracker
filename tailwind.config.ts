import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        walnut: {
          DEFAULT: "#3E2723",
          light: "#5D4037",
          deep: "#2A1A16",
        },
        track: "#EDE4D3",
        brass: {
          DEFAULT: "#B08D57",
          light: "#D4B483",
        },
        felt: "#2F5233",
        skunk: "#A13D2B",
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
