<template>
  <UTabs
    v-model="model"
    class="tabs"
    :items="items"
    :unmount-on-hide="false"
    size="lg"
    :ui="{ root: 'items-start gap-4', list: 'w-auto' }"
  >
    <template
      v-for="tab in tabs"
      #[tab.value]
      :key="tab.value"
    >
      <slot :name="tab.value" />
    </template>
  </UTabs>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

interface TabItem {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  tabs: TabItem[]
}>()

const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

// Each tab renders the parent's slot of the same name.
const items = computed<TabsItem[]>(() =>
  props.tabs.map(tab => ({ label: tab.label, value: tab.value, slot: tab.value }))
)
</script>

<style scoped>
/* Panels stay mounted (unmount-on-hide is off) so their Firestore subscriptions
   and form state survive tab switches. The newly shown one fades + slides in. */
.tabs :deep([data-slot="content"][data-state="active"]) {
  animation: tab-pane-in 0.25s ease;
}

@media (prefers-reduced-motion: reduce) {
  .tabs :deep([data-slot="content"][data-state="active"]) {
    animation: none;
  }
}

@keyframes tab-pane-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
