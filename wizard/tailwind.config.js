/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        portal: {
          bg: "#0B0F14",
          surface: "#141A22",
          surface2: "#1A2230",
          border: "#222B38",
          borderStrong: "#2A3445",
          accent: "#FF4D2E",
          accentHover: "#FF6347",
          accentDim: "#3B1C13",
          amber: "#F5A623",
          green: "#22C55E",
          red: "#EF4444",
          text: "#F5F7FA",
          muted: "#8B98A9",
          mutedDim: "#5F6B7B",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
