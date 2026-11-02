/** @type {import('tailwindcss').Config} */

// One token set for the whole app. Every existing utility class (bg-blue-600,
// text-gray-500, rounded-lg, shadow ...) resolves to these values, so pages stay
// on-theme without per-page overrides.
const ink = {
  50: "#f6f8fa",
  100: "#eef2f5",
  200: "#dfe6ec",
  300: "#c8d3dc",
  400: "#8d9ead",
  500: "#66798a",
  600: "#4d5f6f",
  700: "#364858",
  800: "#1e3244",
  900: "#0a1f2e",
};

// Marindustrial blue, darkened enough that white text on 600+ passes AA.
const brand = {
  50: "#eaf5fa",
  100: "#d4ebf5",
  200: "#aedaed",
  300: "#7cc3e0",
  400: "#3aa5d0",
  500: "#0088b8",
  600: "#006f9f",
  700: "#005a82",
  800: "#004766",
  900: "#003449",
};

const good = {
  50: "#eaf4ee",
  100: "#d3e9dc",
  200: "#a8d3b8",
  300: "#7fba98",
  400: "#58a07a",
  500: "#3f8a63",
  600: "#2f7550",
  700: "#25603f",
  800: "#1c4a31",
  900: "#143826",
};

const warn = {
  50: "#fbf3e2",
  100: "#f6e5bf",
  200: "#ecce8c",
  300: "#dfb258",
  400: "#cc9230",
  500: "#b9791a",
  600: "#a06612",
  700: "#86540f",
  800: "#6b430d",
  900: "#52340b",
};

const bad = {
  50: "#fbeceb",
  100: "#f6d5d2",
  200: "#ecaaa5",
  300: "#df7d75",
  400: "#d05c52",
  500: "#c4443a",
  600: "#b3392f",
  700: "#962f27",
  800: "#7a2620",
  900: "#5f1e19",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
    },
    borderRadius: {
      none: "0",
      sm: "3px",
      DEFAULT: "4px",
      md: "6px",
      lg: "6px",
      xl: "8px",
      "2xl": "8px",
      "3xl": "8px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      sm: "0 1px 1px rgba(10, 31, 46, 0.05)",
      DEFAULT: "0 1px 2px rgba(10, 31, 46, 0.06)",
      md: "0 1px 2px rgba(10, 31, 46, 0.06)",
      lg: "0 10px 28px -6px rgba(10, 31, 46, 0.22)",
      xl: "0 10px 28px -6px rgba(10, 31, 46, 0.22)",
      "2xl": "0 10px 28px -6px rgba(10, 31, 46, 0.22)",
      inner: "none",
    },
    extend: {
      colors: {
        ink,
        brand,
        good,
        warn,
        bad,
        signal: "#00aeef",
        primary: brand[600],
        gray: ink,
        slate: ink,
        zinc: ink,
        neutral: ink,
        blue: brand,
        sky: brand,
        cyan: brand,
        indigo: brand,
        purple: brand,
        violet: brand,
        green: good,
        emerald: good,
        teal: good,
        yellow: warn,
        amber: warn,
        orange: warn,
        red: bad,
        rose: bad,
        pink: bad,
      },
    },
  },
  plugins: [],
};
