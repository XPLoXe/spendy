import { CATEGORY_PALETTE } from './constants'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        // Category colour palette (shared with constants/index.ts). Exposes
        category: CATEGORY_PALETTE
      }
    }
  },
  plugins: []
}
