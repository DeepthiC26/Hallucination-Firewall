import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F1F5F9",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        accent: { DEFAULT: "#0891B2", light: "#E0F2FE", dark: "#0E7490" },
        safe: "#16A34A",
        uncertain: "#D97706",
        danger: "#DC2626",
        muted: "#64748B",
        subtle: "#94A3B8",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["DM Sans", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
        accent: "0 4px 14px 0 rgb(8 145 178 / 0.25)",
      },
      animation: {
        "pulse-danger": "pulse-danger 1.5s ease-in-out infinite",
        "glow-accent": "glow-accent 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
      },
      keyframes: {
        "pulse-danger": {
          "0%, 100%": { borderColor: "#DC2626" },
          "50%": { borderColor: "#DC262644" },
        },
        "glow-accent": {
          "0%, 100%": { boxShadow: "0 0 8px rgb(8 145 178 / 0.3)" },
          "50%": { boxShadow: "0 0 20px rgb(8 145 178 / 0.5)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}

export default config
