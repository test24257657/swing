import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* V1 light theme tokens — mirrors CSS custom properties in globals.css */
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",
        "surface-inset": "var(--color-surface-inset)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-tint": "var(--color-accent-tint)",
        text: "var(--color-text)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        "text-faint": "var(--color-text-faint)",
        up: "var(--color-up)",
        "up-text": "var(--color-up-text)",
        down: "var(--color-down)",
        "down-text": "var(--color-down-text)",
        stale: "var(--color-stale)",
        "stale-text": "var(--color-stale-text)",
        "stale-bg": "var(--color-stale-bg)",
        info: "var(--color-info)",
        "info-text": "var(--color-info-text)",

        /*
         * V2 terminal-* compatibility aliases — remapped to V1 light equivalents so
         * existing page components continue to compile without full rewrites.
         * Semantic intent is preserved: bg→page bg, card→surface, bull→up, etc.
         */
        terminal: {
          bg: "#f5f5f6",          // was #090d16  → light page bg
          card: "#ffffff",        // was #0f1624  → white card
          cardHover: "#efeff1",   // was #151f33  → surface-2 hover
          border: "rgba(9,9,11,0.10)", // was #1c2638 → light border
          subtle: "rgba(9,9,11,0.06)", // was #24324a → faint subtle
          text: "#18181b",        // was #e1e7f0  → dark text on light bg
          muted: "#8b8b93",       // was #7d8b9f  → muted stays similar
          bull: "#15803d",        // was #00d084  → green (darker for light bg)
          bear: "#b91c1c",        // was #ff4d6a  → red (darker for light bg)
          accent: "#7c3aed",      // was #38bdf8  → violet accent
          gold: "#b45309",        // was #fbbf24  → amber (darker for light bg)
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      height: {
        topbar: "var(--shell-topbar-h)",
      },
      width: {
        rail: "var(--shell-rail-w)",
      },
    },
  },
  plugins: [],
};

export default config;
