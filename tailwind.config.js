/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    screens: {
      sm: "640px",
      sm1: "686px",
      md1: "720px",
      md: "768px",
      "1md": "769px",
      "2md": "800px",
      "3md": "872px",
      lg1: "1000px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    fontFamily: {
      inter: ["Inter", "sans-serif"],
      mono: ["Roboto Mono", "monospace"],
    },
    extend: {
      maxWidth: {
        maxContent: "1260px",
        maxContentTab: "650px",
      },
    },
  },
  plugins: [],
}
