<template>
  <div class="expense-section">
    <div
      class="tab-bar"
      role="tablist"
    >
      <button
        class="tab-button"
        :class="{ 'tab-button-active': activeTab === 'list' }"
        role="tab"
        :aria-selected="activeTab === 'list'"
        @click="activeTab = 'list'"
      >
        Expenses
      </button>
      <button
        class="tab-button"
        :class="{ 'tab-button-active': activeTab === 'stats' }"
        role="tab"
        :aria-selected="activeTab === 'stats'"
        @click="activeTab = 'stats'"
      >
        Stats
      </button>
    </div>

    <ExpenseList v-show="activeTab === 'list'" />
    <ExpenseStats v-show="activeTab === 'stats'" />
  </div>
</template>

<script setup lang="ts">
const activeTab = ref<'list' | 'stats'>('list')
</script>

<style scoped>
.expense-section {
  @apply space-y-4;
}

.tab-bar {
  @apply inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1;
}

.tab-button {
  @apply px-4 py-2 text-sm font-medium text-gray-600 rounded-md transition-colors duration-200 hover:text-gray-900;
}

.tab-button-active {
  @apply bg-white text-gray-900 shadow-sm;
}
</style>
