// App-wide constants shared across components.

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
// category/expense and used as-is for the Excel export. On screen each one is
// shown through its theme token (see categoryColorVar), so it follows the
// light, dark and cyberpunk themes.
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

const PALETTE_KEY_BY_COLOR = new Map(
  Object.entries(CATEGORY_PALETTE).map(([key, color]) => [color.toUpperCase(), key])
)

// CSS colour for displaying a stored category colour. Palette colours resolve to
// their `--category-<key>` theme token (defined in assets/css/main.css); anything
// else is shown as stored.
export const categoryColorVar = (color: string) => {
  // Older documents may lack a colour, so don't assume a string.
  const key = color ? PALETTE_KEY_BY_COLOR.get(color.toUpperCase()) : undefined
  return key ? `var(--category-${key})` : color
}
