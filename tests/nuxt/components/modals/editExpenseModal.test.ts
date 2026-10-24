import { describe, expect, it } from 'vitest'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import EditExpenseModal from '~/components/modals/editExpenseModal.vue'
import type { Category, Expense } from '~/types'
import { findButton } from '../../helpers/dom'

mockComponent('UModal', async () => (await import('../../helpers/stubs')).ModalStub)
mockComponent('USelect', async () => (await import('../../helpers/stubs')).SelectStub)

const CATEGORIES = [
  { id: 'food', name: 'Food', color: '#10B981' },
  { id: 'travel', name: 'Travel', color: '#EF4444' }
] as Category[]

// 2 May 2026 at 08:15:30.250, a time of day that must survive a date change.
const CREATED_AT = new Date(2026, 4, 2, 8, 15, 30, 250)

const EXPENSE = {
  id: 'e1',
  amount: 12.5,
  description: 'Lunch',
  categoryId: 'food',
  categoryName: 'Food',
  categoryColor: '#10B981',
  createdAt: CREATED_AT
} as Expense

const mountModal = (expense: Expense | null = EXPENSE, categories = CATEGORIES) =>
  mountSuspended(EditExpenseModal, { props: { expenseToEdit: expense, categories } })

const savedPayload = async (wrapper: Awaited<ReturnType<typeof mountModal>>) => {
  await findButton(wrapper, 'Save').trigger('click')
  return wrapper.emitted<[Record<string, unknown>]>('updateExpense')![0]![0]
}

describe('editExpenseModal', () => {
  it('fills the form from the expense', async () => {
    const wrapper = await mountModal()

    expect(wrapper.find<HTMLInputElement>('input[type="number"]').element.value).toBe('12.5')
    expect(wrapper.find<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-05-02')
    expect(wrapper.find<HTMLSelectElement>('select').element.value).toBe('food')
  })

  it('reads Firestore timestamps', async () => {
    const wrapper = await mountModal({
      ...EXPENSE,
      createdAt: { toDate: () => new Date(2026, 0, 9) } as unknown as Date
    })

    expect(wrapper.find<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-01-09')
  })

  it('reads serialised timestamps', async () => {
    const wrapper = await mountModal({
      ...EXPENSE,
      createdAt: { seconds: new Date(2026, 2, 4).getTime() / 1000 } as unknown as Date
    })

    expect(wrapper.find<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-03-04')
  })

  it('saves unchanged values as they were', async () => {
    const wrapper = await mountModal()

    expect(await savedPayload(wrapper)).toEqual({
      amount: 12.5,
      createdAt: CREATED_AT,
      categoryId: 'food',
      categoryName: 'Food',
      categoryColor: '#10B981'
    })
  })

  it('moves the expense to a new date and keeps its time of day', async () => {
    const wrapper = await mountModal()

    await wrapper.find('input[type="date"]').setValue('2026-04-28')

    expect((await savedPayload(wrapper)).createdAt).toEqual(new Date(2026, 3, 28, 8, 15, 30, 250))
  })

  it('saves a new amount as a number', async () => {
    const wrapper = await mountModal()

    await wrapper.find('input[type="number"]').setValue('7.25')

    expect((await savedPayload(wrapper)).amount).toBe(7.25)
  })

  it('takes the new category\'s name and colour', async () => {
    const wrapper = await mountModal()

    await wrapper.find('select').setValue('travel')

    expect(await savedPayload(wrapper)).toMatchObject({
      categoryId: 'travel',
      categoryName: 'Travel',
      categoryColor: '#EF4444'
    })
  })

  it('keeps the stored name and colour when the category no longer exists', async () => {
    const wrapper = await mountModal(EXPENSE, [])

    expect(await savedPayload(wrapper)).toMatchObject({
      categoryId: 'food',
      categoryName: 'Food',
      categoryColor: '#10B981'
    })
  })

  it.each(['Cancel', 'Dismiss'])('emits cancelEdit on %s', async (action) => {
    const wrapper = await mountModal()

    await findButton(wrapper, action).trigger('click')

    expect(wrapper.emitted('cancelEdit')).toHaveLength(1)
    expect(wrapper.emitted('updateExpense')).toBeUndefined()
  })
})
