<template>
  <!-- Mounted by the parent with v-if; dismissing it counts as Cancel. -->
  <UModal
    :open="true"
    title="Edit Expense"
    @update:open="emit('cancelEdit')"
  >
    <template #body>
      <div class="modal-body">
        <UFormField label="Amount">
          <UInput
            v-model.number="form.amount"
            class="w-full"
            type="number"
            min="0.01"
            step="0.01"
          />
        </UFormField>
        <UFormField label="Date">
          <UInput
            v-model="form.date"
            class="w-full"
            type="date"
          />
        </UFormField>
        <UFormField label="Category">
          <USelect
            v-model="form.categoryId"
            class="w-full"
            :items="categoryItems"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="modal-actions">
        <UButton @click="save">
          Save
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="emit('cancelEdit')"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Expense, Category } from '~/types'


const props = defineProps<{
  expenseToEdit: Expense | null
  categories: Category[]
}>()
const emit = defineEmits(['updateExpense', 'cancelEdit'])

const categoryItems = computed(() =>
  props.categories.map(category => ({ value: category.id, label: category.name }))
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDate = (date: any): Date => {
  if (typeof date?.toDate === 'function') return date.toDate()
  if (typeof date?.seconds === 'number') return new Date(date.seconds * 1000)
  return new Date(date)
}

// Date-only string (YYYY-MM-DD) for the date input. The time-of-day is kept
// internal and never shown to the user.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDateInput = (date: any): string => {
  const d = toDate(date)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
      form.date = toDateInput(expense.createdAt)
      form.categoryId = expense.categoryId
    }
  },
  { immediate: true }
)

const save = () => {
  const selectedCategory = props.categories.find(c => c.id === form.categoryId)

  // Combine the picked date with the original expense's time-of-day so the
  // internal timestamp (and same-day ordering) is preserved when only the
  // date is edited.
  const [year, month, day] = form.date.split('-').map(Number)
  const original = props.expenseToEdit ? toDate(props.expenseToEdit.createdAt) : new Date()
  const createdAt = new Date(
    year!, month! - 1, day!,
    original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds()
  )

  emit('updateExpense', {
    amount: form.amount,
    createdAt,
    categoryId: form.categoryId,
    categoryName: selectedCategory?.name ?? props.expenseToEdit?.categoryName ?? '',
    categoryColor: selectedCategory?.color ?? props.expenseToEdit?.categoryColor ?? ''
  })
}
</script>

<style scoped>
@reference "~/assets/css/main.css";

.modal-body {
  @apply space-y-4;
}

.modal-actions {
  @apply flex w-full justify-end gap-3;
}
</style>
