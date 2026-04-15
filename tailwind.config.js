/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f7f9fc",
        surface: "#f7f9fc",
        "surface-bright": "#f7f9fc",
        "surface-dim": "#d8dadd",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f7",
        "surface-container": "#eceef1",
        "surface-container-high": "#e6e8eb",
        "surface-container-highest": "#e0e3e6",
        "surface-variant": "#e0e3e6",
        "surface-tint": "#1c695f",
        primary: "#00453d",
        secondary: "#006b5f",
        tertiary: "#622d1b",
        error: "#ba1a1a",
        outline: "#6f7976",
        "outline-variant": "#bec9c5",
        "on-background": "#191c1e",
        "on-surface": "#191c1e",
        "on-surface-variant": "#3f4946",
        "on-primary": "#ffffff",
        "on-primary-container": "#8dd5c8",
        "on-primary-fixed": "#00201c",
        "on-primary-fixed-variant": "#005047",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#006f64",
        "on-secondary-fixed": "#00201c",
        "on-secondary-fixed-variant": "#005047",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ffb69f",
        "on-tertiary-fixed": "#380d02",
        "on-tertiary-fixed-variant": "#6f3725",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "inverse-on-surface": "#eff1f4",
        "inverse-surface": "#2d3133",
        "inverse-primary": "#8cd4c7",
        "primary-container": "#075e54",
        "secondary-container": "#8cf1e1",
        "error-container": "#ffdad6",
        "primary-fixed": "#a8f0e3",
        "primary-fixed-dim": "#8cd4c7",
        "secondary-fixed": "#8ff4e3",
        "secondary-fixed-dim": "#72d8c8",
        "tertiary-fixed": "#ffdbd0",
        "tertiary-fixed-dim": "#ffb59e"
      },
      fontFamily: {
        body: ["Inter", "sans-serif"],
        headline: ["Manrope", "sans-serif"],
        label: ["Inter", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "9999px"
      },
      boxShadow: {
        botanical: "0 32px 64px -12px rgba(0, 69, 61, 0.06)"
      }
    }
  },
  plugins: []
};
