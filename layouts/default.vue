<template>
  <div>
    <!-- Same structure as the layer's default layout, plus the account
         controls in the navbar. -->
    <AleNavbar :current="appConfig.site.appId">
      <template #right>
        <AuthButton
          :show-error="false"
          compact
        />
      </template>
    </AleNavbar>

    <UMain>
      <slot />
    </UMain>

    <AleFooter />
  </div>
</template>

<script setup lang="ts">
const appConfig = useAppConfig()
</script>
