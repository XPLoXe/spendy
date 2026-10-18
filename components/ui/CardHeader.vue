<template>
  <div
    class="card-header"
    :class="{ 'card-header-stacked': stacked }"
  >
    <!-- Used in UCard's #header slot, which replaces the card's own title, so
         the title keeps the layer's `ale-card-title` hook for the cyberpunk skin. -->
    <h2 class="card-title ale-card-title">
      {{ title }}
    </h2>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  // Stack the title above the actions below the md breakpoint.
  stacked?: boolean
}>()
</script>

<style scoped>
@reference "~/assets/css/main.css";

.card-header {
  @apply flex items-center justify-between gap-3;
}

.card-header-stacked {
  @apply flex-col items-start md:flex-row md:items-center;
}

.card-title {
  @apply text-xl font-semibold text-highlighted;
}
</style>
