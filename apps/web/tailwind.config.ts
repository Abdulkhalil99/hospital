import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Noto Naskh Arabic', 'serif'],
        sans:   ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
