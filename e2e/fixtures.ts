import { test as base, expect, type Page } from '@playwright/test'

export type Theme = 'light' | 'dark' | 'cyberpunk'

export interface ThemeOptions {
  theme: Theme
}

// Light and dark are Nuxt UI's colour mode; cyberpunk is the design system's
// skin cookie, which always renders dark.
const COLOR_MODE: Record<Theme, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  cyberpunk: 'dark'
}

export const test = base.extend<ThemeOptions & { consoleErrors: string[] }>({
  theme: ['light', { option: true }],

  colorScheme: async ({ theme }, use) => {
    await use(COLOR_MODE[theme])
  },

  context: async ({ context, theme, baseURL }, use) => {
    const mode = COLOR_MODE[theme]

    // Overrides whatever the saved session had picked, before any page script runs.
    await context.addInitScript((value) => {
      window.localStorage.setItem('nuxt-color-mode', value)
    }, mode)
    await context.addCookies([{
      name: 'ale-skin',
      value: theme === 'cyberpunk' ? 'cyberpunk' : 'default',
      url: baseURL!
    }])

    await use(context)
  },

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console: ${message.text()}`)
      }
    })
    await use(errors)
  }
})

export { expect }

// "$1,000.00", "-$42.50", "Daily budget: $3.10", "$-5.00" -> number
export const money = (text: string): number =>
  Number.parseFloat(text.replace(/[^0-9.-]/g, ''))

export const usd = (value: number) => `$${value.toFixed(2)}`

export const toDateInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Same formatting as ExpenseList.formatDate.
export const listDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const openDashboard = async (page: Page) => {
  await page.goto('/')
  const account = page.getByRole('button', { name: /^Account menu for/ })
  const signIn = page.getByRole('button', { name: /Sign in/ }).first()

  await expect(account.or(signIn)).toBeVisible({ timeout: 30_000 })
  if (await signIn.isVisible()) {
    throw new Error('The saved session is signed out or expired. Run `npm run test:e2e:login` and try again.')
  }

  await expect(page.locator('.wallet-balance')).toBeVisible()
  // The list shows a spinner until its first Firestore snapshot; counting rows
  // or reading totals before then sees an empty, all-zero dashboard.
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0)
}

export const readWallet = async (page: Page) => {
  const stats = page.locator('.wallet-stats .stat-value')
  const read = async () => ({
    balance: money(await page.locator('.wallet-balance').innerText()),
    month: Math.abs(money(await stats.nth(0).innerText()))
  })

  // The card paints $0.00 until its own wallet snapshot lands, independently
  // of the list, so wait until two reads in a row agree.
  let last = await read()
  await expect.poll(async () => {
    const next = await read()
    const settled = next.balance === last.balance && next.month === last.month
    last = next
    return settled
  }, { intervals: [500] }).toBe(true)
  return last
}

// WalletCard's rule: what is left, spread over the days left in the month.
export const expectedDailyBudget = (remaining: number, now = new Date()) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return remaining / Math.max(1, daysInMonth - now.getDate())
}

export const selectOption = async (page: Page, trigger: ReturnType<Page['locator']>, option: string) => {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

// Saved under test-results/screenshots/<theme>/ as well as attached to the
// report, so a run's screenshots can be found by theme and name.
export const screenshot = async (page: Page, name: string) => {
  const info = test.info()
  const path = `test-results/screenshots/${info.project.name}/${name.replace(/\s+/g, '-')}.png`

  await page.screenshot({
    path,
    fullPage: true,
    // Full-page captures are stitched while scrolling, which leaves the sticky
    // navbar painted half way down the page.
    style: 'header { position: static !important; }'
  })
  await info.attach(name, { path, contentType: 'image/png' })
}
