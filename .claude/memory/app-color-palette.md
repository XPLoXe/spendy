---
name: app-color-palette
description: Spendy colors must come from CATEGORY_PALETTE in constants/index.ts, never raw Tailwind color utilities
metadata:
  type: feedback
---

Never introduce raw Tailwind color utilities (`text-red-600`, `bg-blue-500`) or
hex literals in Spendy components. The app palette is already defined once in
`constants/index.ts` as `CATEGORY_PALETTE`, which `tailwind.config.js` imports
and exposes under `theme.extend.colors.category`. Use the generated utilities
instead: `text-category-red`, `bg-category-blue`, `border-category-amber`, and so
on. For values consumed by JavaScript (chart fills, inline styles, Excel
export), import `CATEGORY_PALETTE` or `DEFAULT_CATEGORY_COLOR` directly.

**Why:** The palette is the single source of truth shared by CSS, charts and the
`.xlsx` export. A raw utility forks that source, so a later palette change
silently leaves the odd element behind, and the value cannot be reused by the
non-CSS consumers.

**How to apply:** Before writing any color into a component, open
`constants/index.ts` and pick the nearest palette entry. Note that semantic
classes in `assets/css/main.css` such as `.text-danger` live in
`@layer components`, so they cannot be used inside a scoped `@apply`; reference
them as plain classes in the template, or `@apply` the `category-*` utility.
Older code still contains pre-existing raw utilities; do not treat those as
precedent.
