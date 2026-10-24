<template>
  <UContainer class="page">
    <!-- Auth is still settling. Coming back from Google this covers the gap
         until getRedirectResult answers; painting the signed-out screen here
         is what made a successful redirect look like a failed sign-in. -->
    <div
      v-if="loading"
      class="welcome-section"
    >
      <UiLoading />
    </div>

    <div
      v-else-if="!user"
      class="welcome-section"
    >
      <div class="welcome-content">
        <h2 class="welcome-title">
          Welcome to Spendy
        </h2>
        <p class="welcome-description">
          Track your daily expenses like a digital wallet.
          Set your balance, categorize expenses, and monitor your spending.
        </p>
        <AuthButton />
      </div>
    </div>

    <div
      v-else
      class="dashboard"
    >
      <!-- Overview: wallet + add-expense/categories tabs -->
      <div class="overview-grid">
        <WalletCard />
        <ManageSection />
      </div>

      <!-- Expenses: list + stats tabs -->
      <ExpenseSection />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { user, loading } = useAuth()
</script>

<style scoped>
@reference "~/assets/css/main.css";

.page {
  @apply py-8;
}

.welcome-section {
  @apply text-center py-12;
}

.welcome-content {
  @apply max-w-md mx-auto;
}

.welcome-title {
  @apply text-3xl font-bold mb-4 text-highlighted;
}

.welcome-description {
  @apply text-toned mb-8;
}

.dashboard {
  @apply space-y-8;
}

.overview-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-6 items-start;
}
</style>
