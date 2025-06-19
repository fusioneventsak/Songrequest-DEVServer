/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'bg-dark-purple/80',
    'bg-neon-purple/20',
    'bg-neon-purple/10',
    'bg-neon-pink/10',
    'bg-neon-pink/20',
    'border-neon-purple/20',
    'border-neon-pink/20'
  ],
  theme: {
    extend: {
      colors: {
        'neon-pink': '#ff00ff',
        'neon-purple': '#9d00ff',
        'dark-purple': '#1a0b2e',
        'darker-purple': '#0f051d',
      },
      backgroundImage: {
        'gradient-neon': 'linear-gradient(45deg, #9d00ff, #ff00ff)',
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
};