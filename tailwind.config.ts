import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pure, restrained palette - white background with near-black ink.
        ink: {
          DEFAULT: "#0A0A0A",
          soft: "#1A1A1A",
          muted: "#525252",
          subtle: "#737373",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          raised: "#FAFAFA",
          sunken: "#F5F5F5",
        },
        line: {
          DEFAULT: "#E5E5E5",
          strong: "#D4D4D4",
        },
        accent: {
          success: "#16A34A",
          warn: "#CA8A04",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        // Wired up via next/font in layout.tsx
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        // Premium, restrained shadows - never chunky.
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
        lift: "0 1px 3px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)",
        ring: "0 0 0 1px rgba(10,10,10,0.08)",
      },
      borderRadius: {
        xl2: "14px",
      },
      animation: {
        "fade-in": "fadeIn 400ms ease-out both",
        "rise-in": "riseIn 500ms ease-out both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
