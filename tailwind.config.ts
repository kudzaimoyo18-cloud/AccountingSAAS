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
        evergreen: {
          DEFAULT: "rgb(var(--evergreen-rgb) / <alpha-value>)",
          deep: "rgb(var(--evergreen-deep-rgb) / <alpha-value>)",
          soft: "rgb(var(--evergreen-soft-rgb) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--line-rgb) / <alpha-value>)",
          strong: "rgb(var(--line-strong-rgb) / <alpha-value>)",
        },
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        positive: "rgb(var(--positive-rgb) / <alpha-value>)",
        // dark workstation sidebar — fixed across light/dark themes
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-rgb) / <alpha-value>)",
          fg: "rgb(var(--sidebar-fg-rgb) / <alpha-value>)",
          muted: "rgb(var(--sidebar-muted-rgb) / <alpha-value>)",
          active: "rgb(var(--sidebar-active-rgb) / <alpha-value>)",
          border: "rgb(var(--sidebar-border-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        // display maps to the same sans — legacy `font-display` usages render
        // as tight-tracked Inter instead of a serif.
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { shell: "82rem" },
      // Stitch shape language: generous rounding — pill buttons/chips,
      // soft 1.25–2rem container corners.
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "2rem",
      },
      boxShadow: {
        // crisp, low, product-grade elevation — not the soft boutique float
        xs: "0 1px 2px rgba(15,23,42,0.05)",
        card: "0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.04)",
        raised: "0 4px 12px -2px rgba(15,23,42,0.10), 0 2px 4px -2px rgba(15,23,42,0.06)",
        lift: "0 10px 24px -8px rgba(15,23,42,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
