import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: 'rgb(var(--color-forest) / <alpha-value>)',
          light: 'rgb(var(--color-forest-light) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'rgb(var(--color-cream) / <alpha-value>)',
          dark: 'rgb(var(--color-cream-dark) / <alpha-value>)',
        },
        blitz: 'rgb(var(--color-blitz) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['Bricolage Grotesque', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'shutter': 'shutter-close 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
}

export default config
