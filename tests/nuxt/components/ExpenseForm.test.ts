import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, type Ref } from 'vue'
import { where } from 'firebase/firestore'
import ExpenseForm from '~/components/ExpenseForm.vue'
import { DEFAULT_CATEGORY_COLOR } from '~/constants'
import { createFirestoreMock, type FirestoreMock } from '../helpers/firestore'
import { findButton } from '../helpers/dom'

const mocks = vi.hoisted(() => ({
  firestore: undefined as unknown as FirestoreMock,
  user: undefined as unknown as Ref<{ uid: string } | null>
}))

mockNuxtImport('useAuth', () => () => ({ user: mocks.user }))
mockNuxtImport('useFirestore', () => () => mocks.firestore)
mockComponent('USelect', async () => (await import('../helpers/stubs')).SelectStub)

const NOW = new Date(2026, 4, 15, 9, 30, 45)

const CATEGORIES = [
  { id: 'food', name: 'Food', color: '#10B981' },
  { id: 'travel', name: 'Travel', color: '#EF4444' }
]

const mountForm = async () => {
  const wrapper = await mountSuspended(ExpenseForm)
  mocks.firestore.emit('categories', CATEGORIES)
  await wrapper.vm.$nextTick()
  return wrapper
}

const fillForm = async (wrapper: Awaited<ReturnType<typeof mountForm>>, values: { amount?: string, description?: string, category?: string, date?: string }) => {
  if (values.amount !== undefined) await wrapper.find('input[type="number"]').setValue(values.amount)
  if (values.description !== undefined) await wrapper.find('input[type="text"]').setValue(values.description)
  if (values.category !== undefined) await wrapper.find('select').setValue(values.category)
  if (values.date !== undefined) await wrapper.find('input[type="date"]').setValue(values.date)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.firestore = createFirestoreMock()
  mocks.user = ref({ uid: 'u1' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ExpenseForm', () => {
  it('offers the user\'s categories', async () => {
    const wrapper = await mountForm()

    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith(
      'categories',
      [where('userId', '==', 'u1')],
      expect.any(Function)
    )
    expect(wrapper.findAll('option').map(option => option.text())).toEqual(['Select a category', 'Food', 'Travel'])
  })

  it('defaults the date to today and caps it there', async () => {
    const wrapper = await mountForm()
    const date = wrapper.find<HTMLInputElement>('input[type="date"]')

    expect(date.element.value).toBe('2026-05-15')
    expect(date.attributes('max')).toBe('2026-05-15')
  })

  it('enables Add Expense only once every field is filled', async () => {
    const wrapper = await mountForm()
    const submit = () => findButton(wrapper, 'Add Expense')

    expect(submit().attributes('disabled')).toBeDefined()

    await fillForm(wrapper, { amount: '12.5', description: 'Lunch' })
    expect(submit().attributes('disabled')).toBeDefined()

    await fillForm(wrapper, { category: 'food' })
    expect(submit().attributes('disabled')).toBeUndefined()
  })

  it('saves the expense on the picked date at the current time', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { amount: '12.5', description: 'Lunch', category: 'food', date: '2026-05-03' })

    await wrapper.find('form').trigger('submit')

    expect(mocks.firestore.addDocument).toHaveBeenCalledWith('expenses', {
      amount: 12.5,
      description: 'Lunch',
      categoryId: 'food',
      categoryName: 'Food',
      categoryColor: '#10B981',
      userId: 'u1',
      createdAt: new Date(2026, 4, 3, 9, 30, 45)
    })
  })

  it('clears the form after saving', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { amount: '12.5', description: 'Lunch', category: 'food', date: '2026-05-03' })

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find<HTMLInputElement>('input[type="text"]').element.value).toBe(''))

    expect(wrapper.find<HTMLInputElement>('input[type="number"]').element.value).toBe('')
    expect(wrapper.find<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-05-15')
  })

  it('falls back to defaults when the category has gone', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { amount: '3', description: 'Snack', category: 'food' })
    mocks.firestore.emit('categories', [])

    await wrapper.find('form').trigger('submit')

    expect(mocks.firestore.addDocument).toHaveBeenCalledWith('expenses', expect.objectContaining({
      categoryId: 'food',
      categoryName: '',
      categoryColor: DEFAULT_CATEGORY_COLOR
    }))
  })

  it('keeps the entry when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.firestore.addDocument.mockRejectedValue(new Error('offline'))
    const wrapper = await mountForm()
    await fillForm(wrapper, { amount: '12.5', description: 'Lunch', category: 'food' })

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith('Error adding expense:', expect.any(Error)))

    expect(wrapper.find<HTMLInputElement>('input[type="text"]').element.value).toBe('Lunch')
  })

  it('does nothing while signed out', async () => {
    mocks.user.value = null
    const wrapper = await mountSuspended(ExpenseForm)

    await wrapper.find('form').trigger('submit')

    expect(mocks.firestore.subscribeToCollection).not.toHaveBeenCalled()
    expect(mocks.firestore.addDocument).not.toHaveBeenCalled()
  })

  it('stops listening when unmounted', async () => {
    const wrapper = await mountForm()

    wrapper.unmount()

    expect(mocks.firestore.listeners[0]!.unsubscribe).toHaveBeenCalled()
  })
})
