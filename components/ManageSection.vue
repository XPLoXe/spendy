<template>
  <UiTabs
    v-model="activeTab"
    :tabs="tabs"
  >
    <template #expense>
      <ExpenseForm />
    </template>
    <template #categories>
      <CategoryManager />
    </template>
  </UiTabs>
</template>

<script setup lang="ts">
const activeTab = ref<'expense' | 'categories'>('expense')

const tabs = [
  { value: 'expense', label: 'Add Expense' },
  { value: 'categories', label: 'Categories' }
]
</script>
