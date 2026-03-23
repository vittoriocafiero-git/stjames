/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        heineken: '#008200',
      },
      fontFamily: {
        vt323: ['VT323', 'monospace'],
      },
    },
  },
  plugins: [],
}
