import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        panel: "#121215",
        edge: "#1f1f24",
        ink: "#e6e6e6",
        muted: "#8a8a92",
        accent: "#ff4d4d",
        ok: "#22c55e",
        warn: "#f59e0b",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
