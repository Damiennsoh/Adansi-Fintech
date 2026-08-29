/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mtn: {
          yellow: '#FFC107',
          dark: '#1a1a2e',
          blue: '#0056b3',
        },
        adansi: {
          primary: '#FFC107',
          secondary: '#1a1a2e',
          accent: '#00C853',
          danger: '#FF1744',
          funeral: '#7C4DFF',
          wedding: '#FF4081',
          health: '#00C853',
          savings: '#2979FF',
          investment: '#FF9100',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
