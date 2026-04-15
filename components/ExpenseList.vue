<template>
  <div class="card">
    <div class="section-header">
      <h2 class="section-title">
        Recent Expenses
      </h2>
      <div class="expense-filters">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search expenses..."
          class="input-field expense-search"
        >
        <select
          v-model="selectedCategory"
          class="input-field expense-category-filter"
        >
          <option value="">
            All Categories
          </option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
        <select
          v-model="selectedMonth"
          class="input-field expense-month-filter"
        >
          <option value="">
            All months
          </option>
          <option
            v-for="month in monthOptions"
            :key="month.value"
            :value="month.value"
          >
            {{ month.label }}
          </option>
        </select>
        <select
          v-model="selectedYear"
          class="input-field expense-year-filter"
        >
          <option value="">
            All years
          </option>
          <option
            v-for="year in availableYears"
            :key="year"
            :value="year.toString()"
          >
            {{ year }}
          </option>
        </select>
      </div>
    </div>

    <div
      v-if="loading"
      class="loading-container"
    >
      <div class="loading-spinner" />
    </div>

    <div
      v-else-if="filteredExpenses.length === 0"
      class="empty-state"
    >
      No expenses found
    </div>

    <div
      v-else
      class="expense-list"
    >
      <div
        v-for="expense in filteredExpenses"
        :key="expense.id"
        class="expense-item"
      >
        <div class="expense-info">
          <div
            class="expense-category-dot"
            :style="{ backgroundColor: expense.categoryColor }"
          />
          <div class="expense-details">
            <div class="expense-description">
              {{ expense.description }}
            </div>
            <div class="expense-category">
              {{ expense.categoryName }}
            </div>
          </div>
        </div>
        <div class="expense-actions">
          <div class="expense-amount">
            <div class="expense-value">
              -${{ expense.amount.toFixed(2) }}
            </div>
            <div class="expense-date">
              {{ formatDate(expense.createdAt) }}
            </div>
          </div>
          <button
            class="delete-expense-btn"
            title="Delete expense"
            @click="confirmDeleteExpense(expense)"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="filteredExpenses.length > 0"
      class="expense-summary"
    >
      <div class="expense-summary-content">
        <span class="expense-count">Total: {{ filteredExpenses.length }} expenses</span>
        <span class="expense-total">
          -${{ filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2) }}
        </span>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <!-- <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal-content">
        <h3 class="modal-header">Delete Expense</h3>
        <div class="modal-body">
          <p class="modal-text">
            Are you sure you want to delete this expense?
          </p>
          <div v-if="expenseToDelete" class="expense-preview">
            <div class="expense-preview-info">
              <div class="expense-preview-description">{{ expenseToDelete.description }}</div>
              <div class="expense-preview-category">{{ expenseToDelete.categoryName }}</div>
            </div>
            <div class="expense-preview-amount">-${{ expenseToDelete.amount.toFixed(2) }}</div>
          </div>
        </div>
        <div class="modal-actions">
          <button
            @click="deleteExpense"
            class="btn-danger modal-button"
          >
            Delete
          </button>
          <button
            @click="cancelDelete"
            class="btn-secondary modal-button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div> -->

    <deleteExpenseModal
      v-if="showDeleteModal"
      :expense-to-delete="expenseToDelete"
      @delete-expense="deleteExpense"
      @cancel-delete="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'
import { where } from 'firebase/firestore'
import deleteExpenseModal from './modals/deleteExpenseModal.vue'

const { user } = useAuth()
const { subscribeToCollection, deleteDocument } = useFirestore()

const expenses = ref<Expense[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedMonth = ref('')
const selectedYear = ref('')
const showDeleteModal = ref(false)
const expenseToDelete = ref<Expense | null>(null)

const monthOptions = [
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' }
] as const

const getExpenseDate = (date: Expense['createdAt']) => {
  const firestoreDate = date as any

  if (typeof firestoreDate?.toDate === 'function') {
    return firestoreDate.toDate()
  }

  if (typeof firestoreDate?.seconds === 'number') {
    return new Date(firestoreDate.seconds * 1000)
  }

  return new Date(date)
}

const availableYears = computed(() => {
  const years = new Set<number>()

  expenses.value.forEach((expense) => {
    years.add(getExpenseDate(expense.createdAt).getFullYear())
  })

  return Array.from(years).sort((a, b) => b - a)
})

const resolvedFilterYear = computed(() => {
  if (selectedYear.value) {
    return Number(selectedYear.value)
  }

  if (!selectedMonth.value) {
    return null
  }

  // When only a month is selected, use the most recent occurrence of that month.
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const monthIndex = Number(selectedMonth.value)

  return monthIndex <= currentMonth ? currentYear : currentYear - 1
})

const filteredExpenses = computed(() => {
  let filtered = [...expenses.value]

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

    filtered = filtered.filter((expense) => {
      const expenseDate = getExpenseDate(expense.createdAt)
      const matchesYear = filterYear === null || expenseDate.getFullYear() === filterYear
      const matchesMonth = !selectedMonth.value || expenseDate.getMonth() === Number(selectedMonth.value)

      return matchesYear && matchesMonth
    })
  }

  return filtered.sort((a, b) => {
    const dateA = getExpenseDate(a.createdAt)
    const dateB = getExpenseDate(b.createdAt)

    return dateB.getTime() - dateA.getTime()
  })
})

watch(availableYears, (years) => {
  if (selectedYear.value && !years.includes(Number(selectedYear.value))) {
    selectedYear.value = ''
  }
})

const formatDate = (date: Expense['createdAt']) => {
  const d = getExpenseDate(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const confirmDeleteExpense = (expense: Expense) => {
  expenseToDelete.value = expense
  showDeleteModal.value = true
}

const deleteExpense = async () => {
  if (!expenseToDelete.value) return

  try {
    await deleteDocument('expenses', expenseToDelete.value.id)
    showDeleteModal.value = false
    expenseToDelete.value = null
  } catch (error) {
    console.error('Error deleting expense:', error)
  }
}

const cancelDelete = () => {
  showDeleteModal.value = false
  expenseToDelete.value = null
}

// Subscribe to expenses changes
watch(user, () => {
  if (user.value) {
    const unsubscribeExpenses = subscribeToCollection(
      'expenses',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        expenses.value = docs as Expense[]
        loading.value = false
      }
    )

    const unsubscribeCategories = subscribeToCollection(
      'categories',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        categories.value = docs as Category[]
      }
    )

    onUnmounted(() => {
      unsubscribeExpenses()
      unsubscribeCategories()
    })
  }
}, { immediate: true })
</script>

<style lang="postcss" scoped>
.section-header {
  @apply flex-col items-start gap-3 md:flex-row md:items-center md:justify-between;
}

.expense-filters {
  @apply flex w-full flex-wrap items-center gap-2 md:w-auto;
}

.expense-search {
  @apply text-sm w-full sm:w-48;
}

.expense-category-filter,
.expense-month-filter,
.expense-year-filter {
  @apply text-sm w-full sm:w-32;
}

.expense-list {
  @apply space-y-3;
}

.expense-item {
  @apply flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50;
}

.expense-info {
  @apply flex items-center space-x-3;
}

.expense-category-dot {
  @apply w-3 h-3 rounded-full;
}

.expense-details {
  @apply flex flex-col;
}

.expense-description {
  @apply font-medium text-gray-900;
}

.expense-category {
  @apply text-sm text-gray-500;
}

.expense-amount {
  @apply text-right;
}

.expense-value {
  @apply font-semibold text-gray-900;
}

.expense-date {
  @apply text-sm text-gray-500;
}

.expense-summary {
  @apply mt-4 pt-4 border-t border-gray-200;
}

.expense-summary-content {
  @apply flex justify-between items-center text-sm;
}

.expense-count {
  @apply text-gray-600;
}

.expense-total {
  @apply font-semibold text-gray-900;
}

.expense-actions {
  @apply flex flex-row justify-center items-center;
}

.delete-expense-btn {
  @apply ml-3 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200;
}
</style>
