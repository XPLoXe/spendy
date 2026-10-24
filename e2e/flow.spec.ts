import type { Page } from '@playwright/test'
import {
  test,
  expect,
  money,
  usd,
  toDateInput,
  listDate,
  openDashboard,
  readWallet,
  expectedDailyBudget,
  selectOption,
  screenshot
} from './fixtures'
import { MONTH_NAMES } from '../constants'

// Everything this suite creates carries this tag, so cleanup can find it, along
// with anything left behind by a run that was aborted half way.
const TAG = 'e2e-'

const WALLET_BALANCE = 1000
const EXPENSE_AMOUNT = 42.5
const EDITED_AMOUNT = 50
const PAST_AMOUNT = 17.25

const tab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true })

const expenseItems = (page: Page, text: string) =>
  page.locator('.expense-item', { hasText: text })

const categoryItems = (page: Page, text: string) =>
  page.locator('.category-item', { hasText: text })

const showAllMonths = async (page: Page) => {
  await selectOption(page, page.getByRole('combobox', { name: 'Filter by month' }), 'All months')
  await selectOption(page, page.getByRole('combobox', { name: 'Filter by year' }), 'All years')
}

const deleteTaggedData = async (page: Page) => {
  await tab(page, 'Expenses').click()
  await showAllMonths(page)
  await page.getByPlaceholder('Search expenses...').fill(TAG)

  const expenses = expenseItems(page, TAG)
  for (let left = await expenses.count(); left > 0; left--) {
    await expenses.first().getByRole('button', { name: 'Delete expense' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(expenses).toHaveCount(left - 1)
  }

  await tab(page, 'Categories').click()
  const categories = categoryItems(page, TAG)
  for (let left = await categories.count(); left > 0; left--) {
    await categories.first().getByRole('button', { name: 'Delete category' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(categories).toHaveCount(left - 1)
  }

  // Filters live in component state; a reload puts them back to "this month".
  await openDashboard(page)
}

const setWallet = async (page: Page, amount: number) => {
  await page.getByRole('button', { name: 'Update wallet balance' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('spinbutton').fill(String(amount))
  await dialog.getByRole('button', { name: 'Update' }).click()
  await expect(dialog).toBeHidden()
}

const addExpense = async (page: Page, expense: { amount: number, description: string, category: string, date: Date }) => {
  await tab(page, 'Add Expense').click()
  const form = page.locator('form.expense-form')
  await form.getByPlaceholder('0.00').fill(String(expense.amount))
  await form.getByPlaceholder('What did you spend on?').fill(expense.description)
  await selectOption(page, form.getByRole('combobox', { name: 'Category', exact: true }), expense.category)
  await form.locator('input[type="date"]').fill(toDateInput(expense.date))
  await form.getByRole('button', { name: 'Add Expense' }).click()

  // The form resets once Firestore has accepted the write.
  await expect(form.getByPlaceholder('What did you spend on?')).toHaveValue('')
}

const expectWallet = async (page: Page, { balance, month }: { balance: number, month: number }) => {
  const stats = page.locator('.wallet-stats .stat-value')
  await expect(page.locator('.wallet-balance')).toHaveText(usd(balance))
  await expect(stats.nth(0)).toHaveText(`-${usd(month)}`)
  await expect(stats.nth(1)).toHaveText(usd(balance))
  await expect(page.locator('.wallet-daily-budget'))
    .toHaveText(`Daily budget: ${usd(expectedDailyBudget(balance))}`)
}

// The list footer must match the rows above it, and with the default filters
// (this month, every category) it must match the wallet's "This month".
const expectListAddsUp = async (page: Page, monthSpent: number) => {
  const rows = page.locator('.expense-item')
  const values = await page.locator('.expense-item .expense-value').allInnerTexts()
  const sum = values.reduce((total, value) => total + Math.abs(money(value)), 0)

  await expect(page.locator('.expense-count')).toHaveText(`Total: ${await rows.count()} expenses`)
  await expect(page.locator('.expense-total')).toHaveText(`-${usd(sum)}`)
  expect(sum).toBeCloseTo(monthSpent, 2)
}

test('wallet, expenses, categories and stats work end to end', async ({ page, theme, consoleErrors }) => {
  const run = `${TAG}${theme}-${Date.now().toString(36)}`
  const category = `${run} Food`
  const renamedCategory = `${run} Groceries`
  const expense = `${run} lunch`
  const pastExpense = `${run} old`

  const today = new Date()
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12)

  await openDashboard(page)
  await deleteTaggedData(page)
  const original = await readWallet(page)
  const monthBefore = original.month

  try {
    await test.step(`the ${theme} theme is applied`, async () => {
      const html = page.locator('html')
      if (theme === 'light') {
        await expect(html).not.toHaveClass(/\bdark\b/)
        await expect(html).not.toHaveAttribute('data-skin', 'cyberpunk')
      } else if (theme === 'dark') {
        await expect(html).toHaveClass(/\bdark\b/)
        await expect(html).not.toHaveAttribute('data-skin', 'cyberpunk')
      } else {
        await expect(html).toHaveAttribute('data-skin', 'cyberpunk')
      }
      await screenshot(page, 'dashboard')
    })

    await test.step('a category can be created', async () => {
      await tab(page, 'Categories').click()
      await page.getByRole('button', { name: 'Add Category' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Add New Category')
      await dialog.getByPlaceholder('Enter category name').fill(category)
      await dialog.getByRole('button', { name: 'green colour' }).click()
      await screenshot(page, 'add category modal')
      await dialog.getByRole('button', { name: 'Add Category' }).click()

      await expect(dialog).toBeHidden()
      await expect(categoryItems(page, category)).toHaveCount(1)
    })

    await test.step('the wallet balance can be edited', async () => {
      await setWallet(page, WALLET_BALANCE)
      await expectWallet(page, { balance: WALLET_BALANCE, month: monthBefore })
    })

    await test.step('an expense can be added', async () => {
      await addExpense(page, { amount: EXPENSE_AMOUNT, description: expense, category, date: today })
    })

    await test.step('the new expense shows in the list', async () => {
      await tab(page, 'Expenses').click()
      const row = expenseItems(page, expense)
      await expect(row).toHaveCount(1)
      await expect(row.locator('.expense-category')).toHaveText(category)
      await expect(row.locator('.expense-value')).toHaveText(`-${usd(EXPENSE_AMOUNT)}`)
      await expect(row.locator('.expense-date')).toHaveText(listDate(today))
    })

    await test.step('wallet and list totals add up', async () => {
      await expectWallet(page, { balance: WALLET_BALANCE - EXPENSE_AMOUNT, month: monthBefore + EXPENSE_AMOUNT })
      await expectListAddsUp(page, monthBefore + EXPENSE_AMOUNT)
    })

    await test.step('the stats show the expense and add up', async () => {
      await tab(page, 'Stats').click()
      const monthSpent = monthBefore + EXPENSE_AMOUNT

      const legend = page.locator('.legend-item', { hasText: category })
      await expect(legend).toHaveCount(1)
      await expect(legend.locator('.legend-value'))
        .toHaveText(`${(EXPENSE_AMOUNT / monthSpent * 100).toFixed(1)}% · -${usd(EXPENSE_AMOUNT)}`)

      await expect(page.locator('.stats-summary-total')).toHaveText(`-${usd(monthSpent)}`)
      await expect(page.locator('.center-primary')).toHaveText(`-${usd(monthSpent)}`)

      const values = await page.locator('.legend-value').allInnerTexts()
      const totals = values.map(value => Math.abs(money(value.split('·')[1]!)))
      const percentages = values.map(value => Number.parseFloat(value))
      expect(totals.reduce((a, b) => a + b, 0)).toBeCloseTo(monthSpent, 2)
      expect(Math.abs(percentages.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(0.05 * percentages.length)

      // Hovering a legend row focuses its slice in the donut's centre.
      await legend.hover()
      await expect(page.locator('.center-secondary')).toHaveText(category)
      await screenshot(page, 'stats')
    })

    await test.step('a past expense stays out of this month but can be found', async () => {
      await addExpense(page, { amount: PAST_AMOUNT, description: pastExpense, category, date: lastMonth })

      // Not this month: the wallet and the default list ignore it.
      await expectWallet(page, { balance: WALLET_BALANCE - EXPENSE_AMOUNT, month: monthBefore + EXPENSE_AMOUNT })
      await tab(page, 'Expenses').click()
      await expect(expenseItems(page, pastExpense)).toHaveCount(0)

      await selectOption(page, page.getByRole('combobox', { name: 'Filter by month' }), MONTH_NAMES[lastMonth.getMonth()]!)
      await selectOption(page, page.getByRole('combobox', { name: 'Filter by year' }), String(lastMonth.getFullYear()))
      const row = expenseItems(page, pastExpense)
      await expect(row).toHaveCount(1)
      await expect(row.locator('.expense-value')).toHaveText(`-${usd(PAST_AMOUNT)}`)
      await expect(row.locator('.expense-date')).toHaveText(listDate(lastMonth))
      await expect(expenseItems(page, expense)).toHaveCount(0)
      await screenshot(page, 'past expenses')

      await openDashboard(page)
    })

    await test.step('a category can be edited, and its expenses follow', async () => {
      await tab(page, 'Categories').click()
      await categoryItems(page, category).getByRole('button', { name: 'Edit category' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Edit Category')
      await expect(dialog.getByPlaceholder('Enter category name')).toHaveValue(category)
      await dialog.getByPlaceholder('Enter category name').fill(renamedCategory)
      await dialog.getByRole('button', { name: 'violet colour' }).click()
      await dialog.getByRole('button', { name: 'Save Changes' }).click()

      await expect(dialog).toBeHidden()
      await expect(categoryItems(page, renamedCategory)).toHaveCount(1)
      await expect(page.locator('.category-item', { hasText: category }).filter({ hasNotText: renamedCategory })).toHaveCount(0)

      await tab(page, 'Expenses').click()
      await expect(expenseItems(page, expense).locator('.expense-category')).toHaveText(renamedCategory)
    })

    await test.step('an expense can be edited, and the totals follow', async () => {
      await expenseItems(page, expense).getByRole('button', { name: 'Edit expense' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Edit Expense')
      await expect(dialog.getByRole('spinbutton')).toHaveValue(String(EXPENSE_AMOUNT))
      await dialog.getByRole('spinbutton').fill(String(EDITED_AMOUNT))
      await screenshot(page, 'edit expense modal')
      await dialog.getByRole('button', { name: 'Save' }).click()
      await expect(dialog).toBeHidden()

      const monthSpent = monthBefore + EDITED_AMOUNT
      await expect(expenseItems(page, expense).locator('.expense-value')).toHaveText(`-${usd(EDITED_AMOUNT)}`)
      await expectWallet(page, { balance: WALLET_BALANCE - EDITED_AMOUNT, month: monthSpent })
      await expectListAddsUp(page, monthSpent)

      await tab(page, 'Stats').click()
      await expect(page.locator('.legend-item', { hasText: renamedCategory }).locator('.legend-value'))
        .toContainText(`-${usd(EDITED_AMOUNT)}`)
      await expect(page.locator('.stats-summary-total')).toHaveText(`-${usd(monthSpent)}`)
    })
  } finally {
    await test.step('clean up and restore the wallet', async () => {
      await deleteTaggedData(page)
      // The modal refuses 0 or less, so a wallet that started there stays at 1000.
      if (original.balance > 0) {
        await setWallet(page, original.balance)
      }
      await expectWallet(page, { balance: original.balance > 0 ? original.balance : WALLET_BALANCE, month: monthBefore })
    })
  }

  expect(consoleErrors, 'no errors in the browser console').toEqual([])
})
