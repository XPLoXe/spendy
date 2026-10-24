---
name: write-unit-tests-with-code
description: Always write or update Vitest unit tests in the same change as any code you add or modify; the pre-push hook blocks pushes with failing tests
metadata:
  type: feedback
---

Whenever you add or change code in Spendy (composables, components, plugins,
constants, pages), write or update the unit tests in the same change. Don't
leave them for a follow-up, and don't ask first.

- Plain logic with no Nuxt runtime goes in `tests/unit/` (Node environment).
- Anything that needs Nuxt (auto-imports, `useState`, plugins, mounting
  components) goes in `tests/nuxt/`, mirroring the source path, for example
  `components/Foo.vue` -> `tests/nuxt/components/Foo.test.ts`.
- Reuse the helpers in `tests/nuxt/helpers/`: `createFirestoreMock` for
  `useFirestore`, the Nuxt UI stand-ins in `stubs.ts` (modal, select,
  dropdown), and `findButton` / `findModal` in `dom.ts`. Never hit a real
  Firebase project.
- Cover behaviour and error paths, not markup. A bug fix gets a test that
  fails without the fix.
- Run `npm test` before finishing; it must be green.

**Why:** A Husky `pre-push` hook runs `npm test` and blocks the push when any
test fails, so untested or broken changes can't ship. The user set this up on
purpose and wants tests to keep pace with the code instead of being backfilled.

**How to apply:** Treat tests as part of the definition of done for every
feature or fix. If a change is genuinely untestable (pure markup, styling),
say so in the summary instead of silently skipping. Updating a test to match a
behaviour change is fine, but say that you did. Still never commit or push
without being asked, see [[no-commit-without-permission]].
