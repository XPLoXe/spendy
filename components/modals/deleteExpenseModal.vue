<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <h3 class="modal-header">
        Delete Expense
      </h3>
      <div class="modal-body">
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
      </div>
      <div class="modal-actions">
        <button
          class="btn-danger modal-button"
          @click="deleteExpense"
        >
          Delete
        </button>
        <button
          class="btn-secondary modal-button"
          @click="cancelDelete"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
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

<style lang="postcss" scoped>
.modal-content {
  @apply bg-white rounded-lg shadow-xl max-w-md w-full mx-4;
}

.modal-header {
  @apply text-lg font-semibold text-gray-900 px-6 py-4 border-b border-gray-200;
}

.modal-body {
  @apply px-6 py-4;
}

.modal-text {
  @apply text-gray-600 mb-4;
}

.expense-preview {
  @apply flex items-center justify-between p-3 bg-gray-50 rounded-lg;
}

.expense-preview-info {
  @apply flex flex-col;
}

.expense-preview-description {
  @apply font-medium text-gray-900;
}

.expense-preview-category {
  @apply text-sm text-gray-500;
}

.expense-preview-amount {
  @apply font-semibold text-gray-900;
}

.modal-actions {
  @apply flex justify-end space-x-3 px-6 py-4 border-t border-gray-200;
}

.modal-button {
  @apply px-4 py-2 rounded-md font-medium transition-colors duration-200;
}
</style>