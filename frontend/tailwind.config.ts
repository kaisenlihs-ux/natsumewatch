import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0613",
          panel: "#120a22",
          elevated: "#1a112e",
          border: "#241738",
        },
        brand: {
          50: "#fff1f2",
          100: "#ffe4e6",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
        },
        accent: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 60px -10px rgba(244, 63, 94, 0.45)",
        soft: "0 8px 30px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "hero-fade":
          "linear-gradient(180deg, rgba(10,6,19,0) 0%, rgba(10,6,19,0.65) 55%, #0a0613 100%)",
        "card-fade":
          "linear-gradient(180deg, rgba(10,6,19,0) 30%, rgba(10,6,19,0.85) 100%)",
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(1.4)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
