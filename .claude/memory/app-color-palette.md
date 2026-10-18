---
name: app-color-palette
description: Spendy colours come from the design system (Nuxt UI semantic tokens) and, for categories, from CATEGORY_PALETTE shown through theme tokens; never raw Tailwind colours or hex in components
metadata:
  type: feedback
---

Never introduce raw Tailwind colour utilities (`text-red-600`, `bg-blue-500`),
`dark:` colour variants or hex literals in Spendy components. Colours come from
two places:

- **UI states and chrome**: Nuxt UI semantic tokens from the `@xploxe/layer`
  design system: `text-error`, `text-success`, `text-muted`, `text-toned`,
  `text-highlighted`, `bg-muted`, `border-default`, `color="error"` on
  components, and so on. They follow light, dark and the cyberpunk skin.
- **Category colours**: `CATEGORY_PALETTE` in `constants/index.ts` holds the
  hex values that are stored on categories/expenses and used as-is by the Excel
  export. On screen, always wrap a stored colour in `categoryColorVar(color)`,
  which resolves it to its `--category-<key>` token. `assets/css/main.css` maps
  each token to design-system tokens per theme (Tailwind 500 shades in light,
  400 in dark, the skin's palette in cyberpunk).

**Why:** The user wants a single source of truth per concern and wants the app
to follow the design system's themes, including cyberpunk. A raw utility or a
hex used for display bypasses the theme (wrong in dark/cyberpunk) and forks the
palette. The cyberpunk skin forces dark through token overrides, not the
`.dark` class, so `dark:` variants also break there.

**How to apply:** Before writing any colour, pick the semantic token or use
`categoryColorVar`. Inline styles and SVG fills take `categoryColorVar(...)`
(SVG via `style`, since a `fill` attribute can't take `var()`); tints use
`color-mix(in oklab, <var> N%, transparent)` rather than a hex alpha suffix.
Excel export and other non-CSS consumers use the stored hex directly.
