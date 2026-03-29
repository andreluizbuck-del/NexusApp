/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "#191919",
          surface: "#232323",
          card: "#2A2A2A",
          border: "#353535",
          accent: "#D4A574",
          accentDim: "#A67C52",
          text: "#ECECEC",
          textDim: "#9A9A9A",
          danger: "#E5534B",
          success: "#57AB5A",
          admin: "#D4A574",
        },
      },
    },
  },
  plugins: [],
};
