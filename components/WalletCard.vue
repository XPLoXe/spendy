<template>
  <div class="card">
    <div class="section-header">
      <h2 class="section-title">
        Wallet
      </h2>
      <button
        class="wallet-edit-btn"
        @click="showEditModal = true"
      >
        Edit
      </button>
    </div>

    <div class="wallet-balance">
      ${{ walletBalance.toFixed(2) }}
    </div>

    <div class="wallet-daily-budget">
      Daily budget: ${{ dailyBudget.toFixed(2) }}
    </div>

    <div class="wallet-stats">
      <div class="stat-item">
        <div class="stat-label">
          This month
        </div>
        <div class="stat-value text-danger">
          -${{ monthlySpent.toFixed(2) }}
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-label">
          Remaining
        </div>
        <div
          class="stat-value"
          :class="remainingBudget >= 0 ? 'text-success' : 'text-danger'"
        >
          ${{ remainingBudget.toFixed(2) }}
        </div>
      </div>
    </div>

    <!-- Edit Wallet Modal -->
    <div
      v-if="showEditModal"
      class="modal-overlay"
    >
      <div class="modal-content">
        <h3 class="modal-header">
          Update Wallet Balance
        </h3>
        <div class="wallet-form">
          <div class="form-group">
            <label class="form-label">New Total Balance</label>
            <input
              v-model="newBalance"
              type="number"
              step="0.01"
              class="input-field"
              placeholder="Enter total wallet balance"
            >
          </div>
          <div class="modal-actions">
            <button
              class="btn-primary modal-button"
              :disabled="!newBalance || newBalance < 0"
              @click="updateWallet"
            >
              Update
            </button>
            <button
              class="btn-secondary modal-button"
              @click="showEditModal = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { where } from 'firebase/firestore'

const { user } = useAuth()
const { addDocument, updateDocument, getDocuments, subscribeToCollection } = useFirestore()

const walletBalance = ref(0)
const monthlySpent = ref(0)
const dailyBudget = ref(0)
const remainingBudget = ref(0)
const showEditModal = ref(false)
const newBalance = ref(0)
const actualWalletBalance = ref(0)

const updateWallet = async () => {
  if (!user.value || !newBalance.value) return

  try {
    const wallets = await getDocuments('wallets', [
      where('userId', '==', user.value.uid)
    ])

    if (wallets.length > 0) {
      await updateDocument('wallets', wallets[0]!.id, {
        balance: parseFloat(newBalance.value.toString())
      })
    } else {
      await addDocument('wallets', {
        userId: user.value.uid,
        balance: parseFloat(newBalance.value.toString())
      })
    }

    // Recalculate stats after updating the wallet balance
    await calculateStats()
    showEditModal.value = false
    newBalance.value = 0
  } catch (error) {
    console.error('Error updating wallet:', error)
  }
}

const updateWalletStats = (actualBalance: number) => {
  actualWalletBalance.value = actualBalance
  updateRemainingBudget()
}

const updateRemainingBudget = () => {
  // Calculate remaining budget
  remainingBudget.value = actualWalletBalance.value - monthlySpent.value

  // Update walletBalance to show remaining budget
  walletBalance.value = remainingBudget.value

  // Update daily budget
  updateDailyBudget()
}

const updateDailyBudget = () => {
  // Calculate daily budget based on remaining budget and days left in month
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysPassed = now.getDate()
  const daysRemaining = Math.max(1, daysInMonth - daysPassed) // At least 1 day remaining

  dailyBudget.value = remainingBudget.value / daysRemaining
}

const calculateStats = async () => {
  if (!user.value) return

  try {
    // Get wallet balance
    const wallets = await getDocuments('wallets', [
      where('userId', '==', user.value.uid)
    ])

    if (wallets.length > 0) {
      const actualBalance = (wallets[0] as any).balance
      actualWalletBalance.value = actualBalance
    }

    // Get monthly expenses
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const expenses = await getDocuments('expenses', [
      where('userId', '==', user.value.uid),
      where('createdAt', '>=', startOfMonth),
      where('createdAt', '<=', endOfMonth)
    ])

    monthlySpent.value = expenses.reduce((sum, expense) => sum + (expense as any).amount, 0)

    // Update remaining budget and daily budget
    updateRemainingBudget()

  } catch (error) {
    console.error('Error calculating stats:', error)
  }
}

// Subscribe to real-time updates for wallet and expenses
watch(user, () => {
  if (user.value) {
    // Subscribe to wallet changes
    const unsubscribeWallets = subscribeToCollection(
      'wallets',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        if (docs.length > 0) {
          const walletData = docs[0] as any
          updateWalletStats(walletData.balance)
        }
      }
    )

    // Subscribe to expenses changes for current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const unsubscribeExpenses = subscribeToCollection(
      'expenses',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        const monthlyExpenses = docs.filter((expense: any) => {
          const expenseDate = new Date(expense.createdAt.seconds ? expense.createdAt.seconds * 1000 : expense.createdAt)
          return expenseDate >= startOfMonth && expenseDate <= endOfMonth
        })

        const totalSpent = monthlyExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
        monthlySpent.value = totalSpent

        // Update remaining budget and daily budget
        updateRemainingBudget()
      }
    )

    onUnmounted(() => {
      unsubscribeWallets()
      unsubscribeExpenses()
    })
  }
}, { immediate: true })
</script>

<style lang="postcss" scoped>
.wallet-edit-btn {
  @apply text-blue-600 hover:text-blue-700 text-sm font-medium;
}

.wallet-balance {
  @apply text-3xl font-bold text-gray-900 mb-2;
}

.wallet-daily-budget {
  @apply text-sm text-gray-600 mb-4;
}

.wallet-stats {
  @apply grid grid-cols-2 gap-4 text-sm;
}

.stat-item {
  @apply flex flex-col;
}

.stat-label {
  @apply text-gray-500;
}

.stat-value {
  @apply font-semibold;
}

.wallet-form {
  @apply space-y-4;
}

.form-group {
  @apply flex flex-col;
}
</style>
