<template>
  <div class="filter-bar">
    <UInput
      v-if="hasSearchBar"
      v-model="searchModel"
      class="filter-search"
      type="text"
      icon="i-lucide-search"
      :placeholder="searchPlaceholder"
    />

    <USelect
      v-if="hasCategoryFilter"
      v-model="categoryModel"
      class="filter-select"
      :items="categoryItems"
      aria-label="Filter by category"
    />

    <USelect
      v-if="hasMonthFilter"
      v-model="monthModel"
      class="filter-select"
      :items="monthItems"
      aria-label="Filter by month"
    />

    <USelect
      v-if="hasYearFilter"
      v-model="yearModel"
      class="filter-select"
      :items="yearItems"
      aria-label="Filter by year"
    />
  </div>
</template>

<script setup lang="ts">
import type { Category } from '~/types'
import { MONTH_OPTIONS } from '~/constants'

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

// USelect items can't have an empty value, which is what the filters use for
// "no filter". The selects use this stand-in and the models map it back to ''.
const ALL = 'all'

const categoryItems = computed(() => [
  { value: ALL, label: 'All Categories' },
  ...props.categories.map(cat => ({ value: cat.id, label: cat.name }))
])

const monthItems = [
  { value: ALL, label: 'All months' },
  { value: 'current', label: 'Current month' },
  ...MONTH_OPTIONS
]

const yearItems = computed(() => [
  { value: ALL, label: 'All years' },
  { value: 'current', label: 'Current year' },
  ...props.availableYears.map(year => ({ value: year.toString(), label: year.toString() }))
])

const toSelect = (value: string) => value || ALL
const fromSelect = (value: string) => value === ALL ? '' : value

// Writable proxies so each field works as its own v-model on the parent.
const searchModel = computed({
  get: () => props.search,
  set: value => emit('update:search', value)
})

const categoryModel = computed({
  get: () => toSelect(props.category),
  set: value => emit('update:category', fromSelect(value))
})

const monthModel = computed({
  get: () => toSelect(props.month),
  set: value => emit('update:month', fromSelect(value))
})

const yearModel = computed({
  get: () => toSelect(props.year),
  set: value => emit('update:year', fromSelect(value))
})

</script>

<style scoped>
@reference "~/assets/css/main.css";

.filter-bar {
  @apply grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap md:items-center;
}

.filter-search {
  @apply w-full md:w-48;
}

.filter-select {
  @apply w-full md:w-36;
}
</style>
