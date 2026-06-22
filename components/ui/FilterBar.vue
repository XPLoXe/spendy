<template>
  <div class="filter-bar">
    <input
      v-if="hasSearchBar"
      v-model="searchModel"
      type="text"
      :placeholder="searchPlaceholder"
      class="input-field filter-search"
    >

    <select
      v-if="hasCategoryFilter"
      v-model="categoryModel"
      class="input-field filter-select"
    >
      <option value="">
        All Categories
      </option>
      <option
        v-for="cat in categories"
        :key="cat.id"
        :value="cat.id"
      >
        {{ cat.name }}
      </option>
    </select>

    <select
      v-if="hasMonthFilter"
      v-model="monthModel"
      class="input-field filter-select"
    >
      <option value="">
        All months
      </option>
      <option value="current">
        Current month
      </option>
      <option
        v-for="monthOption in monthOptions"
        :key="monthOption.value"
        :value="monthOption.value"
      >
        {{ monthOption.label }}
      </option>
    </select>

    <select
      v-if="hasYearFilter"
      v-model="yearModel"
      class="input-field filter-select"
    >
      <option value="">
        All years
      </option>
      <option value="current">
        Current year
      </option>
      <option
        v-for="yearOption in availableYears"
        :key="yearOption"
        :value="yearOption.toString()"
      >
        {{ yearOption }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { Category } from '~/types'

const props = withDefaults(defineProps<{
  hasSearchBar?: boolean
  hasCategoryFilter?: boolean
  hasMonthFilter?: boolean
  hasYearFilter?: boolean
  search?: string
  category?: string
  month?: string
  year?: string
  categories?: Category[]
  availableYears?: number[]
  searchPlaceholder?: string
}>(), {
  hasSearchBar: false,
  hasCategoryFilter: false,
  hasMonthFilter: false,
  hasYearFilter: false,
  search: '',
  category: '',
  month: '',
  year: '',
  categories: () => [],
  availableYears: () => [],
  searchPlaceholder: 'Search...'
})

const emit = defineEmits([
  'update:search',
  'update:category',
  'update:month',
  'update:year'
])

// Writable proxies so each field works as its own v-model on the parent.
const searchModel = computed({
  get: () => props.search,
  set: value => emit('update:search', value)
})

const categoryModel = computed({
  get: () => props.category,
  set: value => emit('update:category', value)
})

const monthModel = computed({
  get: () => props.month,
  set: value => emit('update:month', value)
})

const yearModel = computed({
  get: () => props.year,
  set: value => emit('update:year', value)
})

const monthOptions = [
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' }
] as const
</script>

<style scoped>
.filter-bar {
  @apply grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap md:items-center;
}

.filter-search {
  @apply text-sm w-full md:w-48;
}

.filter-select {
  @apply text-sm w-full md:w-32;
}
</style>
