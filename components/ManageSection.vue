<template>
  <div class="manage-section">
    <div
      class="tab-bar"
      role="tablist"
    >
      <button
        class="tab-button"
        :class="{ 'tab-button-active': activeTab === 'expense' }"
        role="tab"
        :aria-selected="activeTab === 'expense'"
        @click="activeTab = 'expense'"
      >
        Add Expense
      </button>
      <button
        class="tab-button"
        :class="{ 'tab-button-active': activeTab === 'categories' }"
        role="tab"
        :aria-selected="activeTab === 'categories'"
        @click="activeTab = 'categories'"
      >
        Categories
      </button>
    </div>

    <ExpenseForm v-show="activeTab === 'expense'" />
    <CategoryManager v-show="activeTab === 'categories'" />
  </div>
</template>

<script setup lang="ts">
const activeTab = ref<'expense' | 'categories'>('expense')
</script>

<style scoped>
.manage-section {
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
