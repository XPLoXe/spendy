<template>
  <UCard>
    <template #header>
      <UiCardHeader title="Add Expense" />
    </template>

    <form
      class="expense-form"
      @submit.prevent="addExpense"
    >
      <UFormField label="Amount">
        <UInput
          v-model="expense.amount"
          class="w-full"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          required
        />
      </UFormField>

      <UFormField label="Description">
        <UInput
          v-model="expense.description"
          class="w-full"
          type="text"
          placeholder="What did you spend on?"
          required
        />
      </UFormField>

      <UFormField label="Category">
        <!-- An empty value shows the placeholder, like the old empty option -->
        <USelect
          v-model="expense.categoryId"
          class="w-full"
          :items="categoryItems"
          placeholder="Select a category"
          required
        />
      </UFormField>

      <UFormField label="Date">
        <UInput
          v-model="expense.date"
          class="w-full"
          type="date"
          :max="today"
          required
        />
      </UFormField>

      <UButton
        type="submit"
        class="expense-submit-btn"
        :disabled="!expense.amount || !expense.description || !expense.categoryId || !expense.date"
      >
        Add Expense
      </UButton>
    </form>
  </UCard>
</template>

<script setup lang="ts">
import type { Category } from '~/types'
import { where } from 'firebase/firestore'
import { DEFAULT_CATEGORY_COLOR } from '~/constants'

const { user } = useAuth()
const { addDocument, subscribeToCollection } = useFirestore()

const categories = ref<Category[]>([])

const categoryItems = computed(() =>
  categories.value.map(category => ({ value: category.id, label: category.name }))
)

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
      categoryColor: selectedCategory?.color || DEFAULT_CATEGORY_COLOR,
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
@reference "~/assets/css/main.css";

.expense-form {
  @apply grid grid-cols-2 gap-x-2 gap-y-4;
}

.expense-submit-btn {
  @apply w-full justify-center;
}
</style>
