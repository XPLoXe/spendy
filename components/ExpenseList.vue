<template>
  <div class="card">
    <div class="section-header">
      <h2 class="section-title">
        Recent Expenses
      </h2>
      <UiFilterBar
        v-model:search="searchQuery"
        v-model:category="selectedCategory"
        v-model:month="selectedMonth"
        v-model:year="selectedYear"
        :categories="categories"
        :available-years="availableYears"
        search-placeholder="Search expenses..."
        has-search-bar
        has-category-filter
        has-month-filter
        has-year-filter
      />
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
            class="edit-expense-btn"
            title="Edit expense"
            @click="confirmEditExpense(expense)"
          >
            <PencilIcon class="w-4 h-4" />
          </button>
          <button
            class="delete-expense-btn"
            title="Delete expense"
            @click="confirmDeleteExpense(expense)"
          >
            <XMarkIcon class="w-4 h-4" />
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

    <deleteExpenseModal
      v-if="showDeleteModal"
      :expense-to-delete="expenseToDelete"
      @delete-expense="deleteExpense"
      @cancel-delete="cancelDelete"
    />

    <editExpenseModal
      v-if="showEditModal"
      :expense-to-edit="expenseToEdit"
      :categories="categories"
      @update-expense="saveEditedExpense"
      @cancel-edit="cancelEdit"
    />
  </div>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'
import { where } from 'firebase/firestore'
import deleteExpenseModal from './modals/deleteExpenseModal.vue'
import editExpenseModal from './modals/editExpenseModal.vue'
import { XMarkIcon, PencilIcon } from '@heroicons/vue/24/outline'

const { user } = useAuth()
const { subscribeToCollection, deleteDocument, updateDocument } = useFirestore()

const expenses = ref<Expense[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const showDeleteModal = ref(false)
const expenseToDelete = ref<Expense | null>(null)
const showEditModal = ref(false)
const expenseToEdit = ref<Expense | null>(null)

const {
  searchQuery,
  selectedCategory,
  selectedMonth,
  selectedYear,
  availableYears,
  filteredExpenses
} = useExpenseFilters(expenses)

const formatDate = (date: Expense['createdAt']) => {
  const d = getExpenseDate(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
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
    // eslint-disable-next-line no-console
    console.error('Error deleting expense:', error)
  }
}

const cancelDelete = () => {
  showDeleteModal.value = false
  expenseToDelete.value = null
}

const confirmEditExpense = (expense: Expense) => {
  expenseToEdit.value = expense
  showEditModal.value = true
}

const saveEditedExpense = async (payload: Partial<Expense>) => {
  if (!expenseToEdit.value) return

  try {
    await updateDocument('expenses', expenseToEdit.value.id, payload)
    showEditModal.value = false
    expenseToEdit.value = null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating expense:', error)
  }
}

const cancelEdit = () => {
  showEditModal.value = false
  expenseToEdit.value = null
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

<style scoped>
.section-header {
  @apply flex-col items-start gap-3 md:flex-row md:items-center md:justify-between;
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

.edit-expense-btn {
  @apply ml-3 p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors duration-200;
}

.delete-expense-btn {
  @apply ml-3 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200;
}
</style>
