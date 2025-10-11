<template>
  <div class="card">
    <h2 class="section-title expense-form-title">Add Expense</h2>
    
    <form @submit.prevent="addExpense" class="expense-form">
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
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">Description</label>
        <input 
          v-model="expense.description"
          type="text"
          class="input-field"
          placeholder="What did you spend on?"
          required
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">Category</label>
        <select 
          v-model="expense.categoryId"
          class="input-field"
          required
        >
          <option value="">Select a category</option>
          <option 
            v-for="category in categories" 
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
      </div>
      
      <button 
        type="submit"
        class="btn-primary expense-submit-btn"
        :disabled="!expense.amount || !expense.description || !expense.categoryId"
      >
        Add Expense
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'
import { where } from 'firebase/firestore'

const { user } = useAuth()
const { addDocument, subscribeToCollection } = useFirestore()

const categories = ref<Category[]>([])
const expense = ref({
  amount: '',
  description: '',
  categoryId: ''
})

const addExpense = async () => {
  if (!user.value || !expense.value.amount || !expense.value.description || !expense.value.categoryId) return
  
  try {
    const selectedCategory = categories.value.find(cat => cat.id === expense.value.categoryId)
    
    await addDocument('expenses', {
      amount: parseFloat(expense.value.amount),
      description: expense.value.description,
      categoryId: expense.value.categoryId,
      categoryName: selectedCategory?.name || '',
      categoryColor: selectedCategory?.color || '#3B82F6',
      userId: user.value.uid
    })
    
    // Reset form
    expense.value = {
      amount: '',
      description: '',
      categoryId: ''
    }
  } catch (error) {
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

<style lang="postcss" scoped>
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
