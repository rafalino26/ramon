/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lilac: {
          light: "#E6DAF8",
          DEFAULT: "#C8A2C8",
          dark: "#A47CA4",
        },
      },
    },
  },
  plugins: [],
};
