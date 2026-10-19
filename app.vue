<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
// Set page title
useHead({
  title: 'Spendy - Track Your Daily Expenses',
  meta: [
    { name: 'description', content: 'Simple expense tracking app to manage your daily spending like a digital wallet.' }
  ]
})
</script>
