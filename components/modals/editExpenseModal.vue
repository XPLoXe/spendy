<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <h3 class="modal-header">
        Edit Expense
      </h3>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input
            v-model.number="form.amount"
            type="number"
            min="0.01"
            step="0.01"
            class="input-field"
          >
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input
            v-model="form.date"
            type="datetime-local"
            class="input-field"
          >
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select
            v-model="form.categoryId"
            class="input-field"
          >
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
      <div class="modal-actions">
        <button
          class="btn-primary modal-button"
          @click="save"
        >
          Save
        </button>
        <button
          class="btn-secondary modal-button"
          @click="emit('cancelEdit')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'


const props = defineProps<{
  expenseToEdit: Expense | null
  categories: Category[]
}>()
const emit = defineEmits(['updateExpense', 'cancelEdit'])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDatetimeLocal = (date: any): string => {
  let d: Date
  if (typeof date?.toDate === 'function') {
    d = date.toDate()
  } else if (typeof date?.seconds === 'number') {
    d = new Date(date.seconds * 1000)
  } else {
    d = new Date(date)
  }
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = reactive({
  amount: 0,
  date: '',
  categoryId: ''
})

watch(
  () => props.expenseToEdit,
  (expense) => {
    if (expense) {
      form.amount = expense.amount
      form.date = toDatetimeLocal(expense.createdAt)
      form.categoryId = expense.categoryId
    }
  },
  { immediate: true }
)

const save = () => {
  const selectedCategory = props.categories.find(c => c.id === form.categoryId)
  emit('updateExpense', {
    amount: form.amount,
    createdAt: new Date(form.date),
    categoryId: form.categoryId,
    categoryName: selectedCategory?.name ?? props.expenseToEdit?.categoryName ?? '',
    categoryColor: selectedCategory?.color ?? props.expenseToEdit?.categoryColor ?? ''
  })
}
</script>

<style scoped>
.modal-content {
  @apply bg-white rounded-lg shadow-xl max-w-md w-full mx-4;
}

.modal-header {
  @apply text-lg font-semibold text-gray-900 px-6 py-4 border-b border-gray-200;
}

.modal-body {
  @apply px-6 py-4 space-y-4;
}

.form-group {
  @apply flex flex-col gap-1;
}

.form-label {
  @apply text-sm font-medium text-gray-700;
}

.modal-actions {
  @apply flex justify-end space-x-3 px-6 py-4 border-t border-gray-200;
}

.modal-button {
  @apply px-4 py-2 rounded-md font-medium transition-colors duration-200;
}
</style>
