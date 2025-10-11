export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
}

export interface Category {
  id: string
  name: string
  color: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface Expense {
  id: string
  amount: number
  description: string
  categoryId: string
  categoryName: string
  categoryColor: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface Wallet {
  id: string
  userId: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

export interface MonthlyStats {
  month: string
  year: number
  totalSpent: number
  totalExpenses: number
  averageDailySpending: number
  remainingBudget: number
}
