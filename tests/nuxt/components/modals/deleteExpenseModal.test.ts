import { describe, expect, it } from 'vitest'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import DeleteExpenseModal from '~/components/modals/deleteExpenseModal.vue'
import type { Expense } from '~/types'
import { findButton } from '../../helpers/dom'

mockComponent('UModal', async () => (await import('../../helpers/stubs')).ModalStub)

const EXPENSE = {
  id: 'e1',
  amount: 12.5,
  description: 'Lunch',
  categoryName: 'Food'
} as Expense

describe('deleteExpenseModal', () => {
  it('previews the expense being deleted', async () => {
    const wrapper = await mountSuspended(DeleteExpenseModal, { props: { expenseToDelete: EXPENSE } })

    expect(wrapper.find('.expense-preview-description').text()).toBe('Lunch')
    expect(wrapper.find('.expense-preview-category').text()).toBe('Food')
    expect(wrapper.find('.expense-preview-amount').text()).toBe('-$12.50')
  })

  it('leaves out the preview without an expense', async () => {
    const wrapper = await mountSuspended(DeleteExpenseModal, { props: { expenseToDelete: null } })

    expect(wrapper.find('.expense-preview').exists()).toBe(false)
  })

  it('emits deleteExpense on Delete', async () => {
    const wrapper = await mountSuspended(DeleteExpenseModal, { props: { expenseToDelete: EXPENSE } })

    await findButton(wrapper, 'Delete').trigger('click')

    expect(wrapper.emitted('deleteExpense')).toHaveLength(1)
    expect(wrapper.emitted('cancelDelete')).toBeUndefined()
  })

  it.each(['Cancel', 'Dismiss'])('emits cancelDelete on %s', async (action) => {
    const wrapper = await mountSuspended(DeleteExpenseModal, { props: { expenseToDelete: EXPENSE } })

    await findButton(wrapper, action).trigger('click')

    expect(wrapper.emitted('cancelDelete')).toHaveLength(1)
    expect(wrapper.emitted('deleteExpense')).toBeUndefined()
  })
})
