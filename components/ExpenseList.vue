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
            All
          </option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
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
const showDeleteModal = ref(false)
const expenseToDelete = ref<Expense | null>(null)

const filteredExpenses = computed(() => {
  let filtered = expenses.value

  if (searchQuery.value) {
    filtered = filtered.filter(expense =>
      expense.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      expense.categoryName.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (selectedCategory.value) {
    filtered = filtered.filter(expense => expense.categoryId === selectedCategory.value)
  }

  return filtered.sort((a, b) => {
    // Handle Firestore timestamp objects and regular Date objects
    const dateA = (a.createdAt as any).seconds ? new Date((a.createdAt as any).seconds * 1000) : new Date(a.createdAt)
    const dateB = (b.createdAt as any).seconds ? new Date((b.createdAt as any).seconds * 1000) : new Date(b.createdAt)

    // Sort by newest first (descending order)
    return dateB.getTime() - dateA.getTime()
  })
})

const formatDate = (date: any) => {
  const d = new Date(date.seconds ? date.seconds * 1000 : date)
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
.expense-filters {
  @apply flex items-center space-x-2;
}

.expense-search {
  @apply text-sm w-48;
}

.expense-category-filter {
  @apply text-sm w-32;
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
