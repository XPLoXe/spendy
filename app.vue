<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-brand">
          <h1 class="app-title">
            Spendy
          </h1>
          <span class="app-subtitle">Track your daily expenses</span>
        </div>
        <AuthButton />
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-main">
      <div
        v-if="!user"
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
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <div class="footer-content">
        <div class="footer-text">
          <p>Spendy - Simple expense tracking for your daily life</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth()

// Set page title
useHead({
  title: 'Spendy - Track Your Daily Expenses',
  meta: [
    { name: 'description', content: 'Simple expense tracking app to manage your daily spending like a digital wallet.' }
  ]
})
</script>

<style scoped>
.app-container {
  @apply min-h-screen bg-gray-50;
}

.app-header {
  @apply bg-white shadow-sm border-b border-gray-200 pb-2;
}

.header-content {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
  @apply flex flex-row justify-between items-center py-4;
}

.header-brand {
  @apply flex flex-col items-start;
}

.app-title {
  @apply text-2xl font-bold text-gray-900;
}

.app-subtitle {
  @apply text-sm text-gray-500;
}

.app-main {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8;
}

.welcome-section {
  @apply text-center py-12;
}

.welcome-content {
  @apply max-w-md mx-auto;
}

.welcome-title {
  @apply text-3xl font-bold text-gray-900 mb-4;
}

.welcome-description {
  @apply text-gray-600 mb-8;
}

.dashboard {
  @apply space-y-8;
}

.overview-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-6 items-start;
}

.app-footer {
  @apply bg-white border-t border-gray-200 mt-12;
}

.footer-content {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6;
}

.footer-text {
  @apply text-center text-sm text-gray-500;
}
</style>
