<template>
  <UiTabs
    v-model="activeTab"
    :tabs="tabs"
  >
    <template #list>
      <ExpenseList />
    </template>
    <template #stats>
      <ExpenseStats />
    </template>
  </UiTabs>
</template>

<script setup lang="ts">
const activeTab = ref<'list' | 'stats'>('list')

const tabs = [
  { value: 'list', label: 'Expenses' },
  { value: 'stats', label: 'Stats' }
]
</script>
