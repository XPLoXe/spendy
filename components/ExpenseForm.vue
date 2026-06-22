<template>
  <div class="card">
    <h2 class="section-title expense-form-title">
      Add Expense
    </h2>

    <form
      class="expense-form"
      @submit.prevent="addExpense"
    >
      <div class="form-group">
        <label class="form-label">Amount</label>
        <input
          v-model="expense.amount"
          type="number"
          step="0.01"
          min="0"
          class="input-field"
          placeholder="0.00"
          required
        >
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <input
          v-model="expense.description"
          type="text"
          class="input-field"
          placeholder="What did you spend on?"
          required
        >
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select
          v-model="expense.categoryId"
          class="input-field"
          required
        >
          <option value="">
            Select a category
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

      <div class="form-group">
        <label class="form-label">Date</label>
        <input
          v-model="expense.date"
          type="date"
          class="input-field"
          :max="today"
          required
        >
      </div>

      <button
        type="submit"
        class="btn-primary expense-submit-btn"
        :disabled="!expense.amount || !expense.description || !expense.categoryId || !expense.date"
      >
        Add Expense
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { Category } from '~/types'
import { where } from 'firebase/firestore'

const { user } = useAuth()
const { addDocument, subscribeToCollection } = useFirestore()

const categories = ref<Category[]>([])

// Local YYYY-MM-DD string for today (used as the date input default and max)
const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = toDateInputValue(new Date())

const expense = ref({
  amount: '',
  description: '',
  categoryId: '',
  date: today
})

const addExpense = async () => {
  if (!user.value || !expense.value.amount || !expense.value.description || !expense.value.categoryId || !expense.value.date) return

  try {
    const selectedCategory = categories.value.find(cat => cat.id === expense.value.categoryId)

    // Build the createdAt from the picked date, keeping the current time-of-day
    // so today's expenses behave exactly as before and same-day ordering works.
    const [year, month, day] = expense.value.date.split('-').map(Number)
    const now = new Date()
    const createdAt = new Date(year!, month! - 1, day!, now.getHours(), now.getMinutes(), now.getSeconds())

    await addDocument('expenses', {
      amount: parseFloat(expense.value.amount),
      description: expense.value.description,
      categoryId: expense.value.categoryId,
      categoryName: selectedCategory?.name || '',
      categoryColor: selectedCategory?.color || '#3B82F6',
      userId: user.value.uid,
      createdAt
    })

    // Reset form
    expense.value = {
      amount: '',
      description: '',
      categoryId: '',
      date: toDateInputValue(new Date())
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding expense:', error)
  }
}

// Subscribe to categories changes
watch(user, () => {
  if (user.value) {
    const unsubscribe = subscribeToCollection(
      'categories',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        categories.value = docs as Category[]
      }
    )

    onUnmounted(() => {
      unsubscribe()
    })
  }
}, { immediate: true })
</script>

<style scoped>
.expense-form-title {
  @apply mb-4;
}

.expense-form {
  @apply space-y-4;
}

.form-group {
  @apply flex flex-col;
}

.expense-submit-btn {
  @apply w-full;
}
</style>
