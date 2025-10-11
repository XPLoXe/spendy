<template>
  <div class="card">
    <div class="section-header">
      <h2 class="section-title">Recent Expenses</h2>
      <div class="expense-filters">
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Search expenses..."
          class="input-field expense-search"
        />
        <select 
          v-model="selectedCategory"
          class="input-field expense-category-filter"
        >
          <option value="">All</option>
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
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
    </div>
    
    <div v-else-if="filteredExpenses.length === 0" class="empty-state">
      No expenses found
    </div>
    
    <div v-else class="expense-list">
      <div 
        v-for="expense in filteredExpenses" 
        :key="expense.id"
        class="expense-item"
      >
        <div class="expense-info">
          <div 
            class="expense-category-dot"
            :style="{ backgroundColor: expense.categoryColor }"
          ></div>
          <div class="expense-details">
            <div class="expense-description">{{ expense.description }}</div>
            <div class="expense-category">{{ expense.categoryName }}</div>
          </div>
        </div>
        <div class="expense-amount">
          <div class="expense-value">-${{ expense.amount.toFixed(2) }}</div>
          <div class="expense-date">{{ formatDate(expense.createdAt) }}</div>
        </div>
      </div>
    </div>
    
    <div v-if="filteredExpenses.length > 0" class="expense-summary">
      <div class="expense-summary-content">
        <span class="expense-count">Total: {{ filteredExpenses.length }} expenses</span>
        <span class="expense-total">
          -${{ filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'
import { where } from 'firebase/firestore'

const { user } = useAuth()
const { subscribeToCollection } = useFirestore()

const expenses = ref<Expense[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('')

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
  
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
</style>
