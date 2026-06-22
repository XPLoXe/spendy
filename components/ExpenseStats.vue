<template>
  <div class="card">
    <div class="section-header stats-header">
      <h2 class="section-title">
        Spending by Category
      </h2>
      <UiFilterBar
        v-model:month="selectedMonth"
        v-model:year="selectedYear"
        :available-years="availableYears"
        has-month-filter
        has-year-filter
      />
    </div>

    <div
      v-if="loading"
      class="loading-container"
    >
      <div class="loading-spinner" />
    </div>

    <div
      v-else-if="categoryTotals.length === 0"
      class="empty-state"
    >
      No expenses found
    </div>

    <div
      v-else
      class="stats-content"
    >
      <div class="chart">
        <svg
          class="donut"
          :viewBox="`0 0 ${CHART.size} ${CHART.size}`"
          role="img"
          aria-label="Spending by category"
        >
          <g
            v-for="slice in slices"
            :key="slice.categoryId"
            class="slice"
            :class="{
              'slice-active': activeCategoryId === slice.categoryId,
              'slice-dim': activeCategoryId && activeCategoryId !== slice.categoryId
            }"
            @mouseenter="hoveredId = slice.categoryId"
            @mouseleave="hoveredId = null"
            @click="togglePin(slice.categoryId)"
          >
            <path
              :d="slice.path"
              :fill="slice.color"
            />
            <text
              v-if="slice.showLabel"
              class="slice-label"
              :x="slice.labelX"
              :y="slice.labelY"
              text-anchor="middle"
              dominant-baseline="central"
            >{{ slice.labelText }}</text>
          </g>

          <text
            class="center-primary"
            :x="CHART.cx"
            :y="CHART.cy - 4"
            text-anchor="middle"
            dominant-baseline="central"
          >{{ centerPrimary }}</text>
          <text
            class="center-secondary"
            :x="CHART.cx"
            :y="CHART.cy + 12"
            text-anchor="middle"
            dominant-baseline="central"
          >{{ centerSecondary }}</text>
        </svg>
      </div>

      <!-- Legend: hover/click links to the chart slice via activeCategoryId -->
      <ul class="legend">
        <li
          v-for="cat in categoryTotals"
          :key="cat.categoryId"
          class="legend-item"
          :class="{ 'legend-item-active': activeCategoryId === cat.categoryId }"
          @mouseenter="hoveredId = cat.categoryId"
          @mouseleave="hoveredId = null"
          @click="togglePin(cat.categoryId)"
        >
          <span
            class="legend-color"
            :style="{ backgroundColor: cat.color }"
          />
          <span class="legend-name">{{ cat.name }}</span>
          <span class="legend-value">
            {{ cat.percentage.toFixed(1) }}% · -${{ cat.total.toFixed(2) }}
          </span>
        </li>
      </ul>
    </div>

    <div
      v-if="categoryTotals.length > 0"
      class="stats-summary"
    >
      <div class="stats-summary-content">
        <span class="stats-summary-label">Total spent</span>
        <span class="stats-summary-total">-${{ grandTotal.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Expense } from '~/types'
import { where } from 'firebase/firestore'

const { user } = useAuth()
const { subscribeToCollection } = useFirestore()

const expenses = ref<Expense[]>([])
const loading = ref(true)

const { selectedMonth, selectedYear, availableYears, filteredExpenses } = useExpenseFilters(expenses, { sort: false })

const hoveredId = ref<string | null>(null)
const pinnedId = ref<string | null>(null)
// Hover takes precedence over a pinned (clicked) selection. Both the chart and
// the legend drive these refs, which is what links the two together.
const activeCategoryId = computed(() => hoveredId.value ?? pinnedId.value)

// Donut geometry, in SVG user units (the viewBox is CHART.size square).
const CHART = { size: 200, cx: 100, cy: 100, outerR: 80, innerR: 52 }
// Inside-slice % labels are hidden below this share to avoid clutter on thin slices.
const LABEL_THRESHOLD = 5

const grandTotal = computed(() =>
  filteredExpenses.value.reduce((sum, expense) => sum + expense.amount, 0)
)

const categoryTotals = computed(() => {
  const totals = new Map<string, { categoryId: string, name: string, color: string, total: number }>()

  for (const expense of filteredExpenses.value) {
    const existing = totals.get(expense.categoryId)
    if (existing) {
      existing.total += expense.amount
    } else {
      totals.set(expense.categoryId, {
        categoryId: expense.categoryId,
        name: expense.categoryName,
        color: expense.categoryColor,
        total: expense.amount
      })
    }
  }

  const total = grandTotal.value

  return Array.from(totals.values())
    .map(cat => ({
      ...cat,
      percentage: total > 0 ? (cat.total / total) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total)
})

const togglePin = (categoryId: string) => {
  pinnedId.value = pinnedId.value === categoryId ? null : categoryId
}

// Drop a hovered/pinned selection if that category leaves the current filter.
watch(categoryTotals, (totals) => {
  const ids = new Set(totals.map(cat => cat.categoryId))
  if (hoveredId.value && !ids.has(hoveredId.value)) hoveredId.value = null
  if (pinnedId.value && !ids.has(pinnedId.value)) pinnedId.value = null
})

const polarToCartesian = (cx: number, cy: number, radius: number, angleDeg: number) => {
  const angle = (angleDeg - 90) * Math.PI / 180
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

const annularSectorPath = (startAngle: number, endAngle: number) => {
  const { cx, cy, outerR, innerR } = CHART
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle)
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle)
  const startInner = polarToCartesian(cx, cy, innerR, endAngle)
  const endInner = polarToCartesian(cx, cy, innerR, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M', startOuter.x, startOuter.y,
    'A', outerR, outerR, 0, largeArc, 0, endOuter.x, endOuter.y,
    'L', endInner.x, endInner.y,
    'A', innerR, innerR, 0, largeArc, 1, startInner.x, startInner.y,
    'Z'
  ].join(' ')
}

const slices = computed(() => {
  const labelRadius = (CHART.outerR + CHART.innerR) / 2
  let cursor = 0

  return categoryTotals.value.map((cat) => {
    const startAngle = (cursor / 100) * 360
    cursor += cat.percentage
    // Clamp so a lone 100% category still draws as a ring (a full 360° arc is a no-op).
    const endAngle = Math.min((cursor / 100) * 360, 359.999)
    const label = polarToCartesian(CHART.cx, CHART.cy, labelRadius, (startAngle + endAngle) / 2)

    return {
      ...cat,
      path: annularSectorPath(startAngle, endAngle),
      labelX: label.x,
      labelY: label.y,
      labelText: `${Math.round(cat.percentage)}%`,
      showLabel: cat.percentage >= LABEL_THRESHOLD
    }
  })
})

const activeCategory = computed(() =>
  categoryTotals.value.find(cat => cat.categoryId === activeCategoryId.value) ?? null
)

const centerPrimary = computed(() =>
  activeCategory.value
    ? `${Math.round(activeCategory.value.percentage)}%`
    : `-$${grandTotal.value.toFixed(2)}`
)

const centerSecondary = computed(() =>
  activeCategory.value ? activeCategory.value.name : 'Total spent'
)

// Subscribe to expenses changes (expense docs carry categoryName/categoryColor,
// so the categories collection isn't needed here).
watch(user, () => {
  if (user.value) {
    const unsubscribeExpenses = subscribeToCollection(
      'expenses',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        expenses.value = docs as Expense[]
        loading.value = false
      }
    )

    onUnmounted(() => {
      unsubscribeExpenses()
    })
  }
}, { immediate: true })
</script>

<style scoped>
.stats-header {
  @apply flex-col items-start gap-3 md:flex-row md:items-center md:justify-between;
}

.stats-content {
  @apply flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8;
}

.chart {
  @apply shrink-0;
}

.donut {
  @apply h-56 w-56;
}

.slice {
  transform-box: view-box;
  transform-origin: center;
  transition: transform 0.2s ease, opacity 0.2s ease;
  cursor: pointer;
}

.slice-active {
  transform: scale(1.05);
}

.slice-dim {
  opacity: 0.4;
}

.slice-label {
  fill: #fff;
  font-size: 9px;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(17, 24, 39, 0.35);
  stroke-width: 0.6px;
  stroke-linejoin: round;
  pointer-events: none;
}

.center-primary {
  fill: #111827;
  font-size: 15px;
  font-weight: 700;
  pointer-events: none;
}

.center-secondary {
  fill: #6b7280;
  font-size: 8.5px;
  font-weight: 500;
  pointer-events: none;
}

.legend {
  @apply flex w-full flex-col gap-1;
}

.legend-item {
  @apply flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors duration-200;
}

.legend-item-active {
  @apply bg-gray-50;
}

.legend-color {
  @apply h-3 w-3 shrink-0 rounded-full;
}

.legend-name {
  @apply font-medium text-gray-900;
}

.legend-value {
  @apply ml-auto text-sm text-gray-500;
}

.stats-summary {
  @apply mt-4 pt-4 border-t border-gray-200;
}

.stats-summary-content {
  @apply flex justify-between items-center text-sm;
}

.stats-summary-label {
  @apply text-gray-600;
}

.stats-summary-total {
  @apply font-semibold text-gray-900;
}
</style>
