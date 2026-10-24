---
name: test-feature
description: Run Spendy's end-to-end Playwright suite against the running app in all three design-system themes (light, dark, cyberpunk), extend it when the current change adds behaviour it doesn't cover, review the screenshots, and report what works and what broke. Use when the user runs /test-feature [theme | what changed] or asks to test the app, check a change in every theme, or click through the flow after a big change.
---

# Test the app end to end

Argument (optional):
- a theme (`light`, `dark` or `cyberpunk`): run only that theme;
- a description of what changed: make sure the suite covers it, then run every theme;
- nothing: run every theme against what is already covered.

The suite lives in `e2e/`:
- `flow.spec.ts` is one test that runs once per theme (`playwright.config.ts` projects).
- `fixtures.ts` holds the theme setup and the helpers.
- `login.mjs` is the one-time Google sign-in.

It drives the real app at http://localhost:3000, signed in as a dummy Firebase account.

## 1. Preconditions

Run these in parallel:

- **Session.** `e2e/.auth/user.json` must exist. If it doesn't, start `npm run test:e2e:login` in the background. Tell the user a Chrome window is open and ask them to sign in there with a dummy Google account. The script waits up to 5 minutes and saves the session by itself.
- **Account.** The session must belong to the dummy account named in the gitignored `.env`.
  - Grep `.env` for `^E2E_ACCOUNT=` and `e2e/.auth/user.json` for `[a-z0-9.]+@gmail\.com`. The two must match exactly.
  - If they differ, or `E2E_ACCOUNT` is missing, stop and ask before running anything. The suite writes to the account's wallet, expenses and categories, so it must never run on a real one.
  - Never write either address into a tracked file. The repo is public.
- **Dev server.** Run `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`. If it isn't running, the Playwright config starts `npm run dev` itself, so this is information, not a blocker.

## 2. Make sure the change is covered

Skip this step when the argument is only a theme.

Read what changed: `git diff main...HEAD --stat`, then the relevant diffs, plus any uncommitted work. Compare it with the steps in `e2e/flow.spec.ts`. The suite covers:

- the theme being applied;
- creating a category;
- editing the wallet balance;
- adding an expense and seeing it in the list;
- the wallet and list totals adding up;
- the stats (legend, donut, totals, percentages);
- past expenses being kept out of this month and found with the month/year filters;
- editing a category, with its expenses following the change;
- editing an expense, with every total following the change.

If the change adds or alters behaviour that none of these checks, add a `test.step` for it to `flow.spec.ts`, or adjust the existing step. Follow these rules:

- **Tag test data.** Every name or description the suite creates must contain the run's `run` string, which starts with `e2e-`. `deleteTaggedData` deletes everything tagged `e2e-` before and after each run. Untagged data is never cleaned up.
- **Check numbers, not just visibility.** Write the expected values from the user's point of view (the wallet goes down by exactly the amount, the totals match the rows) and compare against the exact formatted text (`usd()`). Don't copy the component's formula; a copied bug passes.
- **Locate elements the way the existing steps do:** roles and accessible names first, then the components' own class names. Don't add `data-testid` attributes to the app just for tests unless there's no other stable handle.
- **Cover new UI in the screenshots.** If the change adds a screen or a modal, call `screenshot(page, '<name>')` while it is showing, so every theme gets checked visually.
- Tell the user which steps you added or changed.

## 3. Run

- All themes: `npx playwright test`. Themes run one after another on purpose, because they share the account's data. Expect about 1.5 minutes.
- One theme: `npx playwright test --project=<theme>`.

Use a timeout of at least 300000 ms.

If a run stops with "The saved session is signed out or expired", go back to the session precondition in step 1, then run again.

## 4. Investigate failures

For each failure, read the error, the call log, and `test-results/<test folder>/error-context.md`, which holds the page snapshot at the moment it failed. Then decide which case it is:

- **App bug:** the app does the wrong thing, for example a wrong total, a missing element, or a console error. That is a finding. Report it with the evidence. Don't change app code unless the user asks.
- **Test that's out of date:** the UI changed on purpose, for example a renamed button or a new layout. Update the locator or the expected value to match the new intended behaviour, and say so.
- **Flaky:** timing or the network. Re-run that theme once. If it passes, report it as flaky; don't hide it.

Never make a test pass by weakening it. That means deleting the assertion, loosening an exact value, or adding a console-error exception for a real error.

## 5. Review the screenshots

Screenshots are saved to `test-results/screenshots/<theme>/<name>.png`:
- `dashboard`
- `add-category-modal`
- `stats`
- `past-expenses`
- `edit-expense-modal`
- anything you added

Read them with the Read tool and compare the same screen across the three themes. Look for:
- text that can't be read against its background, or contrast that is too low;
- elements that overlap, overflow or get clipped;
- colours that ignore the theme, such as raw light-mode colours showing in dark or cyberpunk;
- anything that looks broken in one theme but fine in the others.

Passing assertions don't prove the page looks right, so this step matters.

## 6. Report

Start with the verdict for each theme, for example "light ✅ dark ✅ cyberpunk ❌". Then give:

- each failure: which step, what happened, and whether you judged it an app bug, an outdated test or flaky;
- visual problems, naming the theme and the screenshot;
- any test steps you added or changed;
- the state of the dummy account, if the suite couldn't restore it. The wallet form refuses 0, so a wallet that started at $0 is left at $1000.

Point to `npm run test:e2e:report` for the full HTML report with traces.

Don't commit or push anything unless the user asks in their message.
