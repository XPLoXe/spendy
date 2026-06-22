import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { Expense } from '~/types'

// Normalize a Firestore Timestamp / { seconds } / Date / string into a JS Date.
export const getExpenseDate = (date: Expense['createdAt']): Date => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firestoreDate = date as any

  if (typeof firestoreDate?.toDate === 'function') {
    return firestoreDate.toDate()
  }

  if (typeof firestoreDate?.seconds === 'number') {
    return new Date(firestoreDate.seconds * 1000)
  }

  return new Date(date)
}

export interface UseExpenseFiltersOptions {
  // Sort the result by date, newest first (default true). The stats view
  // aggregates totals and doesn't need ordering, so it opts out.
  sort?: boolean
}

/**
 * Search / category / month / year filtering for a list of expenses.
 * The 'current' sentinel resolves to this month / this year at read time.
 */
export const useExpenseFilters = (
  expenses: Ref<Expense[]>,
  options: UseExpenseFiltersOptions = {}
) => {
  const { sort = true } = options

  const searchQuery = ref('')
  const selectedCategory = ref('')
  const selectedMonth = ref('current')
  const selectedYear = ref('current')

  const availableYears = computed(() => {
    const years = new Set<number>()

    expenses.value.forEach((expense) => {
      years.add(getExpenseDate(expense.createdAt).getFullYear())
    })

    return Array.from(years).sort((a, b) => b - a)
  })

  // Normalize the month filter: '' = all months, 'current' = this month, otherwise 0-11.
  const monthFilter = computed(() => {
    if (!selectedMonth.value) return null
    if (selectedMonth.value === 'current') return new Date().getMonth()
    return Number(selectedMonth.value)
  })

  const resolvedFilterYear = computed(() => {
    if (selectedYear.value === 'current') {
      return new Date().getFullYear()
    }

    if (selectedYear.value) {
      return Number(selectedYear.value)
    }

    if (monthFilter.value === null) {
      return null
    }

    // When only a month is selected, use the most recent occurrence of that month.
    const now = new Date()
    return monthFilter.value <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1
  })

  const filteredExpenses = computed(() => {
    let filtered = expenses.value

    const normalizedSearchQuery = searchQuery.value.trim().toLowerCase()
    if (normalizedSearchQuery) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(normalizedSearchQuery) ||
        expense.categoryName.toLowerCase().includes(normalizedSearchQuery)
      )
    }

    if (selectedCategory.value) {
      filtered = filtered.filter(expense => expense.categoryId === selectedCategory.value)
    }

    if (selectedMonth.value || selectedYear.value) {
      const filterYear = resolvedFilterYear.value
      const filterMonth = monthFilter.value

      filtered = filtered.filter((expense) => {
        const expenseDate = getExpenseDate(expense.createdAt)
        const matchesYear = filterYear === null || expenseDate.getFullYear() === filterYear
        const matchesMonth = filterMonth === null || expenseDate.getMonth() === filterMonth

        return matchesYear && matchesMonth
      })
    }

    if (!sort) {
      return filtered
    }

    return [...filtered].sort((a, b) =>
      getExpenseDate(b.createdAt).getTime() - getExpenseDate(a.createdAt).getTime()
    )
  })

  // Drop a stale year selection if it leaves the available list (keep 'current').
  watch(availableYears, (years) => {
    if (selectedYear.value && selectedYear.value !== 'current' && !years.includes(Number(selectedYear.value))) {
      selectedYear.value = ''
    }
  })

  return {
    searchQuery,
    selectedCategory,
    selectedMonth,
    selectedYear,
    availableYears,
    filteredExpenses
  }
}
