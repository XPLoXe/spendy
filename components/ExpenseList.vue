<template>
  <UCard>
    <template #header>
      <UiCardHeader
        title="Recent Expenses"
        stacked
      >
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
      </UiCardHeader>
    </template>

    <UiLoading v-if="loading" />

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
            :style="{ backgroundColor: categoryColorVar(expense.categoryColor) }"
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
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Edit expense"
            aria-label="Edit expense"
            @click="confirmEditExpense(expense)"
          />
          <UButton
            icon="i-lucide-x"
            color="error"
            variant="ghost"
            size="xs"
            title="Delete expense"
            aria-label="Delete expense"
            @click="confirmDeleteExpense(expense)"
          />
        </div>
      </div>
    </div>

    <template
      v-if="filteredExpenses.length > 0"
      #footer
    >
      <div class="expense-summary-content">
        <span class="expense-count">Total: {{ filteredExpenses.length }} expenses</span>
        <span class="expense-total">
          -${{ filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2) }}
        </span>
      </div>
    </template>

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
  </UCard>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'
import { where } from 'firebase/firestore'
import deleteExpenseModal from './modals/deleteExpenseModal.vue'
import editExpenseModal from './modals/editExpenseModal.vue'
import { categoryColorVar } from '~/constants'

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
@reference "~/assets/css/main.css";

.empty-state {
  @apply text-center py-8 text-muted;
}

.expense-list {
  @apply space-y-3;
}

.expense-item {
  @apply flex items-center justify-between gap-3 p-3 rounded-lg border border-default hover:bg-muted;
}

.expense-info {
  @apply flex min-w-0 items-center gap-3;
}

.expense-category-dot {
  @apply size-3 shrink-0 rounded-full;
}

.expense-details {
  @apply flex min-w-0 flex-col;
}

.expense-description {
  @apply font-medium text-highlighted;
}

.expense-category {
  @apply text-sm text-muted;
}

.expense-amount {
  @apply text-right;
}

.expense-value {
  @apply font-semibold text-highlighted;
}

.expense-date {
  @apply text-sm text-muted;
}

.expense-summary-content {
  @apply flex justify-between items-center text-sm;
}

.expense-count {
  @apply text-muted;
}

.expense-total {
  @apply font-semibold text-highlighted;
}

.expense-actions {
  @apply flex shrink-0 flex-row justify-center items-center gap-1;
}
</style>
