import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Expense } from '~/types'
import { getExpenseDate, useExpenseFilters } from '~/composables/useExpenseFilters'

// "Now" for every test: 15 May 2026, so 'current' means May 2026.
const NOW = new Date(2026, 4, 15, 12)

let nextId = 0
const expense = (overrides: Partial<Expense> & { createdAt: Expense['createdAt'] }): Expense => ({
  id: `e${++nextId}`,
  amount: 10,
  description: 'Coffee',
  categoryId: 'food',
  categoryName: 'Food',
  categoryColor: '#3B82F6',
  userId: 'u1',
  updatedAt: overrides.createdAt,
  ...overrides
})

const ids = (expenses: Expense[]) => expenses.map(e => e.id)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getExpenseDate', () => {
  it('returns Dates as they are', () => {
    const date = new Date(2026, 0, 2)
    expect(getExpenseDate(date)).toEqual(date)
  })

  it('converts Firestore Timestamps', () => {
    const date = new Date(2026, 0, 2)
    const timestamp = { toDate: () => date } as unknown as Date
    expect(getExpenseDate(timestamp)).toBe(date)
  })

  it('converts serialised { seconds } timestamps', () => {
    const date = new Date(2026, 0, 2)
    const serialised = { seconds: date.getTime() / 1000 } as unknown as Date
    expect(getExpenseDate(serialised)).toEqual(date)
  })

  it('parses date strings', () => {
    expect(getExpenseDate('2026-01-02T10:00:00Z' as unknown as Date))
      .toEqual(new Date('2026-01-02T10:00:00Z'))
  })
})

describe('useExpenseFilters', () => {
  it('defaults to the current month and year, newest first', () => {
    const early = expense({ createdAt: new Date(2026, 4, 2) })
    const late = expense({ createdAt: new Date(2026, 4, 10) })
    const lastMonth = expense({ createdAt: new Date(2026, 3, 30) })
    const lastYear = expense({ createdAt: new Date(2025, 4, 10) })

    const { filteredExpenses } = useExpenseFilters(ref([early, lastMonth, late, lastYear]))

    expect(ids(filteredExpenses.value)).toEqual([late.id, early.id])
  })

  it('lists each year that has expenses, newest first', () => {
    const { availableYears } = useExpenseFilters(ref([
      expense({ createdAt: new Date(2024, 1, 1) }),
      expense({ createdAt: new Date(2026, 1, 1) }),
      expense({ createdAt: new Date(2024, 6, 1) }),
      expense({ createdAt: new Date(2025, 1, 1) })
    ]))

    expect(availableYears.value).toEqual([2026, 2025, 2024])
  })

  it('searches descriptions and category names, ignoring case and whitespace', () => {
    const coffee = expense({ description: 'Morning Coffee', createdAt: new Date(2026, 4, 1) })
    const taxi = expense({ description: 'Taxi', categoryName: 'Transport', createdAt: new Date(2026, 4, 2) })
    const filters = useExpenseFilters(ref([coffee, taxi]))

    filters.searchQuery.value = '  COFFEE '
    expect(ids(filters.filteredExpenses.value)).toEqual([coffee.id])

    filters.searchQuery.value = 'transport'
    expect(ids(filters.filteredExpenses.value)).toEqual([taxi.id])

    filters.searchQuery.value = '   '
    expect(filters.filteredExpenses.value).toHaveLength(2)
  })

  it('filters by category', () => {
    const food = expense({ categoryId: 'food', createdAt: new Date(2026, 4, 1) })
    const travel = expense({ categoryId: 'travel', createdAt: new Date(2026, 4, 2) })
    const filters = useExpenseFilters(ref([food, travel]))

    filters.selectedCategory.value = 'travel'

    expect(ids(filters.filteredExpenses.value)).toEqual([travel.id])
  })

  it('shows everything when month and year are both cleared', () => {
    const filters = useExpenseFilters(ref([
      expense({ createdAt: new Date(2023, 0, 1) }),
      expense({ createdAt: new Date(2026, 4, 1) })
    ]))

    filters.selectedMonth.value = ''
    filters.selectedYear.value = ''

    expect(filters.filteredExpenses.value).toHaveLength(2)
  })

  it('shows every month of a chosen year', () => {
    const jan = expense({ createdAt: new Date(2025, 0, 5) })
    const dec = expense({ createdAt: new Date(2025, 11, 5) })
    const other = expense({ createdAt: new Date(2026, 0, 5) })
    const filters = useExpenseFilters(ref([jan, dec, other]))

    filters.selectedMonth.value = ''
    filters.selectedYear.value = '2025'

    expect(ids(filters.filteredExpenses.value)).toEqual([dec.id, jan.id])
  })

  it('matches a specific month and year', () => {
    const march2025 = expense({ createdAt: new Date(2025, 2, 5) })
    const march2026 = expense({ createdAt: new Date(2026, 2, 5) })
    const filters = useExpenseFilters(ref([march2025, march2026]))

    filters.selectedMonth.value = '2'
    filters.selectedYear.value = '2025'

    expect(ids(filters.filteredExpenses.value)).toEqual([march2025.id])
  })

  it('combines the current month with a chosen year', () => {
    const may2025 = expense({ createdAt: new Date(2025, 4, 5) })
    const may2026 = expense({ createdAt: new Date(2026, 4, 5) })
    const filters = useExpenseFilters(ref([may2025, may2026]))

    filters.selectedYear.value = '2025'

    expect(ids(filters.filteredExpenses.value)).toEqual([may2025.id])
  })

  describe('with a month but no year', () => {
    const march2025 = expense({ createdAt: new Date(2025, 2, 5) })
    const march2026 = expense({ createdAt: new Date(2026, 2, 5) })
    const sept2025 = expense({ createdAt: new Date(2025, 8, 5) })
    const sept2026 = expense({ createdAt: new Date(2026, 8, 5) })
    const all = [march2025, march2026, sept2025, sept2026]

    it('uses this year for a month that has already happened', () => {
      const filters = useExpenseFilters(ref(all))
      filters.selectedYear.value = ''
      filters.selectedMonth.value = '2'

      expect(ids(filters.filteredExpenses.value)).toEqual([march2026.id])
    })

    it('uses last year for a month that is still to come', () => {
      const filters = useExpenseFilters(ref(all))
      filters.selectedYear.value = ''
      filters.selectedMonth.value = '8'

      expect(ids(filters.filteredExpenses.value)).toEqual([sept2025.id])
    })

    it('uses this year for the current month', () => {
      const may2026 = expense({ createdAt: new Date(2026, 4, 1) })
      const filters = useExpenseFilters(ref([...all, may2026]))
      filters.selectedYear.value = ''

      expect(ids(filters.filteredExpenses.value)).toEqual([may2026.id])
    })
  })

  it('keeps the original order when sorting is turned off', () => {
    const early = expense({ createdAt: new Date(2026, 4, 2) })
    const late = expense({ createdAt: new Date(2026, 4, 10) })

    const { filteredExpenses } = useExpenseFilters(ref([early, late]), { sort: false })

    expect(ids(filteredExpenses.value)).toEqual([early.id, late.id])
  })

  it('reacts to new expenses', () => {
    const expenses = ref<Expense[]>([])
    const { filteredExpenses } = useExpenseFilters(expenses)

    expenses.value = [expense({ createdAt: new Date(2026, 4, 3) })]

    expect(filteredExpenses.value).toHaveLength(1)
  })

  it('drops a selected year once no expenses are left in it', async () => {
    const old = expense({ createdAt: new Date(2024, 1, 1) })
    const recent = expense({ createdAt: new Date(2026, 1, 1) })
    const expenses = ref([old, recent])
    const filters = useExpenseFilters(expenses)

    filters.selectedYear.value = '2024'
    expenses.value = [recent]
    await nextTick()

    expect(filters.selectedYear.value).toBe('')
  })

  it('keeps the current-year selection when the year list changes', async () => {
    const expenses = ref([expense({ createdAt: new Date(2024, 1, 1) })])
    const filters = useExpenseFilters(expenses)

    expenses.value = []
    await nextTick()

    expect(filters.selectedYear.value).toBe('current')
  })
})
