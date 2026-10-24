import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { where } from 'firebase/firestore'
import WalletCard from '~/components/WalletCard.vue'
import { createFirestoreMock, type FirestoreMock } from '../helpers/firestore'
import { findButton } from '../helpers/dom'

const mocks = vi.hoisted(() => ({
  firestore: undefined as unknown as FirestoreMock,
  user: undefined as unknown as Ref<{ uid: string } | null>
}))

mockNuxtImport('useAuth', () => () => ({ user: mocks.user }))
mockNuxtImport('useFirestore', () => () => mocks.firestore)
mockComponent('UModal', async () => (await import('../helpers/stubs')).ModalStub)

// 15 May 2026: May has 31 days, so 16 are left for the daily budget.
const NOW = new Date(2026, 4, 15, 12)
const DAYS_LEFT = 16

const seconds = (date: Date) => ({ seconds: date.getTime() / 1000 })

const mountWallet = async ({ balance = 1000, expenses = [] as Array<Record<string, unknown>> } = {}) => {
  const wrapper = await mountSuspended(WalletCard)
  mocks.firestore.emit('wallets', [{ id: 'w1', balance }])
  mocks.firestore.emit('expenses', expenses.map((expense, index) => ({ id: `e${index}`, ...expense })))
  await wrapper.vm.$nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountWallet>>

const statValue = (wrapper: Wrapper, label: string) =>
  wrapper.findAll('.stat-item').find(item => item.find('.stat-label').text() === label)!.find('.stat-value')

const openEditModal = async (wrapper: Wrapper) => {
  await findButton(wrapper, 'Update wallet balance').trigger('click')
  return wrapper.find('[data-testid="modal"]')
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

describe('WalletCard', () => {
  it('listens to the user\'s wallet and expenses', async () => {
    await mountWallet()

    const constraint = [where('userId', '==', 'u1')]
    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith('wallets', constraint, expect.any(Function))
    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith('expenses', constraint, expect.any(Function))
  })

  it('subtracts this month\'s spending from the balance', async () => {
    const wrapper = await mountWallet({
      balance: 1000,
      expenses: [
        { amount: 60, createdAt: new Date(2026, 4, 1) },
        { amount: 40, createdAt: seconds(new Date(2026, 4, 14)) },
        // Outside this month: ignored.
        { amount: 500, createdAt: new Date(2026, 3, 30, 23, 59) },
        { amount: 500, createdAt: new Date(2026, 5, 1) }
      ]
    })

    expect(wrapper.find('.wallet-balance').text()).toBe('$900.00')
    expect(statValue(wrapper, 'This month').text()).toBe('-$100.00')
    expect(statValue(wrapper, 'Remaining').text()).toBe('$900.00')
    expect(statValue(wrapper, 'Remaining').classes()).toContain('text-success')
  })

  it('spreads what is left over the rest of the month', async () => {
    const wrapper = await mountWallet({ balance: 800 })

    expect(wrapper.find('.wallet-daily-budget').text()).toBe(`Daily budget: $${(800 / DAYS_LEFT).toFixed(2)}`)
  })

  it('counts at least one day left on the last day of the month', async () => {
    vi.setSystemTime(new Date(2026, 4, 31, 12))
    const wrapper = await mountWallet({ balance: 75 })

    expect(wrapper.find('.wallet-daily-budget').text()).toBe('Daily budget: $75.00')
  })

  it('flags an overspent month', async () => {
    const wrapper = await mountWallet({
      balance: 50,
      expenses: [{ amount: 80, createdAt: new Date(2026, 4, 2) }]
    })

    expect(statValue(wrapper, 'Remaining').text()).toBe('$-30.00')
    expect(statValue(wrapper, 'Remaining').classes()).toContain('text-error')
  })

  describe('updating the balance', () => {
    it('only allows a positive amount', async () => {
      const wrapper = await mountWallet()
      const modal = await openEditModal(wrapper)
      const update = () => findButton(modal, 'Update')

      expect(update().attributes('disabled')).toBeDefined()

      await modal.find('input').setValue('-5')
      expect(update().attributes('disabled')).toBeDefined()

      await modal.find('input').setValue('250')
      expect(update().attributes('disabled')).toBeUndefined()
    })

    it('stores the new balance plus this month\'s spending', async () => {
      mocks.firestore.getDocuments.mockImplementation(async (collection: string) =>
        collection === 'wallets' ? [{ id: 'w1', balance: 1000 }] : [{ id: 'e1', amount: 100 }]
      )
      const wrapper = await mountWallet({
        balance: 1000,
        expenses: [{ amount: 100, createdAt: new Date(2026, 4, 2) }]
      })
      const modal = await openEditModal(wrapper)

      await modal.find('input').setValue('500')
      await findButton(modal, 'Update').trigger('click')
      await flushPromises()

      // The card shows balance minus spending, so 500 is shown when 600 is stored.
      expect(mocks.firestore.updateDocument).toHaveBeenCalledWith('wallets', 'w1', { balance: 600 })
      expect(mocks.firestore.addDocument).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
    })

    it('creates the wallet the first time', async () => {
      const wrapper = await mountWallet()
      const modal = await openEditModal(wrapper)

      await modal.find('input').setValue('300')
      await findButton(modal, 'Update').trigger('click')
      await flushPromises()

      expect(mocks.firestore.addDocument).toHaveBeenCalledWith('wallets', { userId: 'u1', balance: 300 })
    })

    it('recalculates this month\'s figures after saving', async () => {
      mocks.firestore.getDocuments.mockImplementation(async (collection: string) =>
        collection === 'wallets' ? [{ id: 'w1', balance: 700 }] : [{ id: 'e1', amount: 20 }, { id: 'e2', amount: 30 }]
      )
      const wrapper = await mountWallet()
      const modal = await openEditModal(wrapper)

      await modal.find('input').setValue('650')
      await findButton(modal, 'Update').trigger('click')
      await flushPromises()

      expect(mocks.firestore.getDocuments).toHaveBeenCalledWith('expenses', [
        where('userId', '==', 'u1'),
        where('createdAt', '>=', new Date(2026, 4, 1)),
        where('createdAt', '<=', new Date(2026, 4, 31, 23, 59, 59, 999))
      ])
      expect(statValue(wrapper, 'This month').text()).toBe('-$50.00')
      expect(wrapper.find('.wallet-balance').text()).toBe('$650.00')
    })

    it('keeps the dialog open when saving fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mocks.firestore.getDocuments.mockRejectedValue(new Error('offline'))
      const wrapper = await mountWallet()
      const modal = await openEditModal(wrapper)

      await modal.find('input').setValue('300')
      await findButton(modal, 'Update').trigger('click')
      await flushPromises()

      expect(console.error).toHaveBeenCalledWith('Error updating wallet:', expect.any(Error))
      expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    })
  })

  it('does nothing while signed out', async () => {
    mocks.user.value = null
    await mountSuspended(WalletCard)

    expect(mocks.firestore.subscribeToCollection).not.toHaveBeenCalled()
  })

  it('stops listening when unmounted', async () => {
    const wrapper = await mountWallet()

    wrapper.unmount()

    expect(mocks.firestore.listeners.every(listener => listener.unsubscribe.mock.calls.length === 1)).toBe(true)
  })
})
