import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50:  '#fdf8f0',
          100: '#faebd7',
          200: '#f3d5a3',
          300: '#eab86a',
          500: '#c8853a',
          700: '#8b5e3c',
          800: '#6f4c31',
          900: '#5a3e28',
        },
      },
    },
  },
  plugins: [],
};

export default config;
