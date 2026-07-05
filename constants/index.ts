// App-wide constants shared across components. Colours defined here are the
// single source of truth: they are also imported into tailwind.config.js so the
// same values are available as `category-*` utility classes.

// Full month names, indexed 0-11 to line up with Date.getMonth().
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const

// Options for a month <select>. `value` is the 0-based month index as a string
// (matching the filter logic); an empty value is handled by the caller.
export const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({
  value: String(index),
  label
}))

// Category colour palette. These are data values: they're stored on each
// category/expense and rendered as inline styles, chart fills and Excel fills.
export const CATEGORY_PALETTE = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#10B981',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#06B6D4',
  lime: '#84CC16'
} as const

// The palette as a flat list, for the category colour picker.
export const CATEGORY_COLORS = Object.values(CATEGORY_PALETTE)

// Fallback colour for a category/expense with no colour set.
export const DEFAULT_CATEGORY_COLOR = CATEGORY_PALETTE.blue
