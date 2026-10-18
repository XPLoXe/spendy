<template>
  <div
    class="loading-container"
    role="status"
    aria-label="Loading"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="loading-spinner"
    />
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

.loading-container {
  @apply flex justify-center items-center py-8;
}

.loading-spinner {
  @apply size-8 animate-spin text-primary;
}
</style>
