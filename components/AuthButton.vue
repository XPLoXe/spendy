<template>
  <div class="auth-root">
    <UIcon
      v-if="loading"
      name="i-lucide-loader-circle"
      class="auth-loading"
    />

    <UDropdownMenu
      v-else-if="user"
      :items="userMenuItems"
      :content="{ align: 'end' }"
    >
      <UButton
        :avatar="{ src: user.photoURL || undefined, alt: userName }"
        color="neutral"
        variant="ghost"
        square
        :aria-label="`Account menu for ${userName}`"
      />
    </UDropdownMenu>

    <!-- In the navbar the button is hidden on phones: the signed-out page
         right below it already shows the full sign-in button. -->
    <UButton
      v-else
      :class="{ 'auth-signin-compact': compact }"
      :disabled="signingIn"
      @click="signInWithGoogle"
    >
      <template #leading>
        <svg
          class="google-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      </template>
      {{ signInLabel }}
    </UButton>

    <UAlert
      v-if="error && showError"
      class="auth-error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error"
      role="alert"
    />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// The error now lives in shared auth state, so every AuthButton on the page
// would otherwise print the same message. The header instance opts out.
const props = defineProps({
  showError: {
    type: Boolean,
    default: true
  },
  // Navbar layout: no sign-in button on small screens.
  compact: {
    type: Boolean,
    default: false
  }
})

const { user, loading, signingIn, error, signInWithGoogle, logout } = useAuth()

const userName = computed(() => user.value?.displayName || user.value?.email || 'User')

// The navbar uses the short label: the full one is too wide for the cyberpunk
// header at the lg breakpoint, and the Google logo already names the provider.
const signInLabel = computed(() => {
  if (signingIn.value) return 'Signing in...'
  return props.compact ? 'Sign in' : 'Sign in with Google'
})

const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: userName.value, type: 'label' }],
  [{ label: 'Logout', icon: 'i-lucide-log-out', onSelect: logout }]
])
</script>

<style scoped>
@reference "~/assets/css/main.css";

.auth-root {
  @apply flex flex-col items-center gap-2;
}

.auth-error {
  @apply max-w-xs text-left;
}

.auth-loading {
  @apply size-5 animate-spin text-muted;
}

.auth-signin-compact {
  @apply max-sm:hidden;
}

.google-icon {
  @apply size-5 shrink-0;
}
</style>
