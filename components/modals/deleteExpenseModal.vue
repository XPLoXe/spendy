<template>
  <!-- Mounted by the parent with v-if; dismissing it counts as Cancel. -->
  <UModal
    :open="true"
    title="Delete Expense"
    @update:open="cancelDelete"
  >
    <template #body>
      <p class="modal-text">
        Are you sure you want to delete this expense?
      </p>
      <div
        v-if="expenseToDelete"
        class="expense-preview"
      >
        <div class="expense-preview-info">
          <div class="expense-preview-description">
            {{ description }}
          </div>
          <div class="expense-preview-category">
            {{ categoryName }}
          </div>
        </div>
        <div class="expense-preview-amount">
          -${{ amount }}
        </div>
      </div>
    </template>

    <template #footer>
      <div class="modal-actions">
        <UButton
          color="error"
          @click="deleteExpense"
        >
          Delete
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="cancelDelete"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Expense } from '~/types'

const props = defineProps<{ expenseToDelete: Expense | null }>()
const description = computed(() => props.expenseToDelete?.description)
const categoryName = computed(() => props.expenseToDelete?.categoryName)
const amount = computed(() => props.expenseToDelete?.amount?.toFixed(2))
const emit = defineEmits(['deleteExpense', 'cancelDelete'])

const deleteExpense = () => {
  emit('deleteExpense')
}

const cancelDelete = () => {
  emit('cancelDelete')
}
</script>

<style scoped>
@reference "~/assets/css/main.css";

.modal-text {
  @apply text-toned mb-4;
}

.expense-preview {
  @apply flex items-center justify-between p-3 bg-muted rounded-lg;
}

.expense-preview-info {
  @apply flex flex-col;
}

.expense-preview-description {
  @apply font-medium text-highlighted;
}

.expense-preview-category {
  @apply text-sm text-muted;
}

.expense-preview-amount {
  @apply font-semibold text-highlighted;
}

.modal-actions {
  @apply flex w-full justify-end gap-3;
}
</style>
