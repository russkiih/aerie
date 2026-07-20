import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm ember palette from the Aerie dashboard redesign. One accent.
        paper: "#1b1917",
        panel: "#221f1c",
        panel2: "#2a2621", // raised: badges, bars, tooltips
        inset: "#1c1916", // recessed: tab rails, card gradient floor
        tile: "#1f1c19", // modal stat tiles + service chips
        line: "#322d27",
        line2: "#2c2721", // inner card dividers
        line3: "#3a342d", // modal / logo borders
        ink: "#f5f0e8",
        muted: "#b3a89b",
        faint: "#7d7469",
        fainter: "#5f584f",
        accent: "#d97757", // terracotta — the single accent
        "accent-dim": "#b45a3a",
        ok: "#7fb896",
        warn: "#e0805f",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: { xl2: "17px" },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.4)",
        "card-hover": "0 14px 34px -12px rgba(0,0,0,.7)",
        pop: "0 30px 80px -20px rgba(0,0,0,.8)",
        tab: "0 1px 2px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)",
      },
    },
  },
  plugins: [],
};

export default config;
