import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
          dim: "rgb(var(--paper-dim-rgb) / <alpha-value>)",
        },
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        brass: {
          DEFAULT: "rgb(var(--brass-rgb) / <alpha-value>)",
          deep: "rgb(var(--brass-deep-rgb) / <alpha-value>)",
        },
        sand: "rgb(var(--sand-rgb) / <alpha-value>)",
        evergreen: "rgb(var(--evergreen-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { shell: "78rem" },
      boxShadow: {
        lift: "0 1px 2px rgba(0,0,0,0.06), 0 12px 32px -12px rgba(0,0,0,0.22)",
        card: "0 1px 0 rgba(0,0,0,0.04), 0 24px 48px -28px rgba(0,0,0,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
