<template>
  <div class="tabs">
    <div
      ref="barRef"
      class="tab-bar"
      role="tablist"
    >
      <!-- Sliding pill that morphs to sit under the active tab -->
      <span
        class="tab-indicator"
        :class="{ 'tab-indicator-ready': ready }"
        :style="indicatorStyle"
        aria-hidden="true"
      />
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-button"
        :class="{ 'tab-button-active': modelValue === tab.value }"
        type="button"
        role="tab"
        :aria-selected="modelValue === tab.value"
        @click="select(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-panels">
      <Transition
        v-for="tab in tabs"
        :key="tab.value"
        name="tab-pane"
      >
        <div
          v-show="modelValue === tab.value"
          class="tab-panel"
          role="tabpanel"
        >
          <slot :name="tab.value" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TabItem {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  tabs: TabItem[]
}>()

const emit = defineEmits(['update:modelValue'])

const select = (value: string) => {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}

const barRef = ref<HTMLElement | null>(null)
const indicator = reactive({ left: 0, width: 0 })
const ready = ref(false)

// Measure the active tab button so the pill can slide/resize to match it.
// Done by measurement (rather than CSS) so it works with any tab widths.
const updateIndicator = () => {
  const bar = barRef.value
  if (!bar) return

  const buttons = bar.querySelectorAll<HTMLElement>('.tab-button')
  const activeIndex = props.tabs.findIndex(tab => tab.value === props.modelValue)
  const activeButton = buttons[activeIndex]

  if (activeButton) {
    indicator.left = activeButton.offsetLeft
    indicator.width = activeButton.offsetWidth
  }
}

const indicatorStyle = computed(() => ({
  transform: `translateX(${indicator.left}px)`,
  width: `${indicator.width}px`
}))

watch(() => props.modelValue, () => nextTick(updateIndicator))

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    updateIndicator()
    // Enable the slide transition only after the first positioning, so the pill
    // doesn't animate in from the corner on initial load.
    requestAnimationFrame(() => {
      ready.value = true
    })
  })

  if (barRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateIndicator())
    resizeObserver.observe(barRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.tabs {
  @apply space-y-4;
}

.tab-bar {
  @apply relative inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1;
}

.tab-indicator {
  @apply absolute rounded-md bg-white shadow-sm;
  top: 4px;
  bottom: 4px;
  left: 0;
  z-index: 0;
}

.tab-indicator-ready {
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-button {
  @apply relative px-4 py-2 text-sm font-medium text-gray-600 transition-colors duration-200 hover:text-gray-900;
  z-index: 1;
}

.tab-button-active {
  @apply text-gray-900;
}

.tab-panels {
  @apply relative;
}

/* Content of the newly selected tab fades + slides in. */
.tab-pane-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.tab-pane-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

/* The outgoing panel is taken out of flow so it cross-fades without a jump. */
.tab-pane-leave-active {
  @apply absolute inset-x-0 top-0;
  transition: opacity 0.15s ease;
}

.tab-pane-leave-to {
  opacity: 0;
}
</style>
