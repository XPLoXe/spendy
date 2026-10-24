import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { where } from 'firebase/firestore'
import ExpenseList from '~/components/ExpenseList.vue'
import { createFirestoreMock, type FirestoreMock } from '../helpers/firestore'
import { findButton, findModal } from '../helpers/dom'

const mocks = vi.hoisted(() => ({
  firestore: undefined as unknown as FirestoreMock,
  user: undefined as unknown as Ref<{ uid: string } | null>
}))

mockNuxtImport('useAuth', () => () => ({ user: mocks.user }))
mockNuxtImport('useFirestore', () => () => mocks.firestore)
mockComponent('UModal', async () => (await import('../helpers/stubs')).ModalStub)
mockComponent('USelect', async () => (await import('../helpers/stubs')).SelectStub)

const NOW = new Date(2026, 4, 15, 12)

const CATEGORIES = [
  { id: 'food', name: 'Food', color: '#10B981' },
  { id: 'travel', name: 'Travel', color: '#EF4444' }
]

const EXPENSES = [
  { id: 'coffee', amount: 3.5, description: 'Coffee', categoryId: 'food', categoryName: 'Food', categoryColor: '#10B981', createdAt: new Date(2026, 4, 2, 8) },
  { id: 'taxi', amount: 20, description: 'Taxi', categoryId: 'travel', categoryName: 'Travel', categoryColor: '#EF4444', createdAt: { seconds: new Date(2026, 4, 10, 18).getTime() / 1000 } },
  { id: 'old', amount: 99, description: 'Old flight', categoryId: 'travel', categoryName: 'Travel', categoryColor: '#EF4444', createdAt: new Date(2025, 11, 20) }
]

const mountList = async ({ expenses = EXPENSES } = {}) => {
  const wrapper = await mountSuspended(ExpenseList)
  mocks.firestore.emit('categories', CATEGORIES)
  mocks.firestore.emit('expenses', expenses)
  await wrapper.vm.$nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountList>>

const descriptions = (wrapper: Wrapper) =>
  wrapper.findAll('.expense-description').map(description => description.text())

const expenseItem = (wrapper: Wrapper, description: string) =>
  wrapper.findAll('.expense-item').find(item => item.text().includes(description))!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.firestore = createFirestoreMock()
  mocks.user = ref({ uid: 'u1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ExpenseList', () => {
  it('shows a loader until the first snapshot arrives', async () => {
    const wrapper = await mountSuspended(ExpenseList)

    expect(wrapper.find('.expense-list').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No expenses found')

    mocks.firestore.emit('expenses', EXPENSES)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.expense-list').exists()).toBe(true)
  })

  it('listens to the user\'s expenses and categories', async () => {
    await mountList()

    const constraint = [where('userId', '==', 'u1')]
    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith('expenses', constraint, expect.any(Function))
    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith('categories', constraint, expect.any(Function))
  })

  it('lists this month\'s expenses, newest first', async () => {
    const wrapper = await mountList()

    expect(descriptions(wrapper)).toEqual(['Taxi', 'Coffee'])
    const taxi = expenseItem(wrapper, 'Taxi')
    expect(taxi.find('.expense-category').text()).toBe('Travel')
    expect(taxi.find('.expense-value').text()).toBe('-$20.00')
    expect(taxi.find('.expense-date').text()).toBe('May 10, 2026')
    expect(taxi.find('.expense-category-dot').attributes('style')).toContain('var(--category-red)')
  })

  it('totals the listed expenses', async () => {
    const wrapper = await mountList()

    expect(wrapper.find('.expense-count').text()).toBe('Total: 2 expenses')
    expect(wrapper.find('.expense-total').text()).toBe('-$23.50')
  })

  it('says so when nothing matches', async () => {
    const wrapper = await mountList({ expenses: [] })

    expect(wrapper.text()).toContain('No expenses found')
    expect(wrapper.find('.expense-count').exists()).toBe(false)
  })

  describe('filters', () => {
    it('searches as you type', async () => {
      const wrapper = await mountList()

      await wrapper.find('input[placeholder="Search expenses..."]').setValue('cof')

      expect(descriptions(wrapper)).toEqual(['Coffee'])
    })

    it('offers the user\'s categories and filters by them', async () => {
      const wrapper = await mountList()
      const categorySelect = wrapper.find('select[aria-label="Filter by category"]')

      expect(categorySelect.findAll('option').map(option => option.text())).toContain('Travel')
      await categorySelect.setValue('travel')

      expect(descriptions(wrapper)).toEqual(['Taxi'])
    })

    it('shows every expense with all months and years', async () => {
      const wrapper = await mountList()

      await wrapper.find('select[aria-label="Filter by month"]').setValue('all')
      await wrapper.find('select[aria-label="Filter by year"]').setValue('all')

      expect(descriptions(wrapper)).toEqual(['Taxi', 'Coffee', 'Old flight'])
    })
  })

  describe('deleting', () => {
    it('confirms, then deletes the expense', async () => {
      const wrapper = await mountList()

      await findButton(expenseItem(wrapper, 'Coffee'), 'Delete expense').trigger('click')
      const modal = findModal(wrapper, 'Delete Expense')
      expect(modal.text()).toContain('Coffee')

      await findButton(modal, 'Delete').trigger('click')
      await flushPromises()

      expect(mocks.firestore.deleteDocument).toHaveBeenCalledWith('expenses', 'coffee')
      expect(findModal(wrapper, 'Delete Expense').exists()).toBe(false)
    })

    it('keeps the expense on cancel', async () => {
      const wrapper = await mountList()

      await findButton(expenseItem(wrapper, 'Coffee'), 'Delete expense').trigger('click')
      await findButton(findModal(wrapper, 'Delete Expense'), 'Cancel').trigger('click')

      expect(mocks.firestore.deleteDocument).not.toHaveBeenCalled()
      expect(findModal(wrapper, 'Delete Expense').exists()).toBe(false)
    })

    it('keeps the dialog open when deleting fails', async () => {
      mocks.firestore.deleteDocument.mockRejectedValue(new Error('offline'))
      const wrapper = await mountList()

      await findButton(expenseItem(wrapper, 'Coffee'), 'Delete expense').trigger('click')
      await findButton(findModal(wrapper, 'Delete Expense'), 'Delete').trigger('click')
      await flushPromises()

      expect(console.error).toHaveBeenCalledWith('Error deleting expense:', expect.any(Error))
      expect(findModal(wrapper, 'Delete Expense').exists()).toBe(true)
    })
  })

  describe('editing', () => {
    it('saves the edited expense', async () => {
      const wrapper = await mountList()

      await findButton(expenseItem(wrapper, 'Coffee'), 'Edit expense').trigger('click')
      const modal = findModal(wrapper, 'Edit Expense')
      await modal.find('input[type="number"]').setValue('4.25')
      await findButton(modal, 'Save').trigger('click')
      await flushPromises()

      expect(mocks.firestore.updateDocument).toHaveBeenCalledWith('expenses', 'coffee', expect.objectContaining({
        amount: 4.25,
        categoryId: 'food'
      }))
      expect(findModal(wrapper, 'Edit Expense').exists()).toBe(false)
    })

    it('discards changes on cancel', async () => {
      const wrapper = await mountList()

      await findButton(expenseItem(wrapper, 'Coffee'), 'Edit expense').trigger('click')
      await findButton(findModal(wrapper, 'Edit Expense'), 'Cancel').trigger('click')

      expect(mocks.firestore.updateDocument).not.toHaveBeenCalled()
      expect(findModal(wrapper, 'Edit Expense').exists()).toBe(false)
    })

    it('keeps the dialog open when saving fails', async () => {
      mocks.firestore.updateDocument.mockRejectedValue(new Error('offline'))
      const wrapper = await mountList()

      await findButton(expenseItem(wrapper, 'Coffee'), 'Edit expense').trigger('click')
      await findButton(findModal(wrapper, 'Edit Expense'), 'Save').trigger('click')
      await flushPromises()

      expect(console.error).toHaveBeenCalledWith('Error updating expense:', expect.any(Error))
      expect(findModal(wrapper, 'Edit Expense').exists()).toBe(true)
    })
  })

  it('does nothing while signed out', async () => {
    mocks.user.value = null
    await mountSuspended(ExpenseList)

    expect(mocks.firestore.subscribeToCollection).not.toHaveBeenCalled()
  })

  it('stops listening when unmounted', async () => {
    const wrapper = await mountList()

    wrapper.unmount()

    expect(mocks.firestore.listeners.every(listener => listener.unsubscribe.mock.calls.length === 1)).toBe(true)
  })
})
