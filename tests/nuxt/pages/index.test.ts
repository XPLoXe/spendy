import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, type Ref } from 'vue'
import IndexPage from '~/pages/index.vue'

const mocks = vi.hoisted(() => ({
  user: undefined as unknown as Ref<{ uid: string } | null>,
  loading: undefined as unknown as Ref<boolean>
}))

mockNuxtImport('useAuth', () => () => ({ user: mocks.user, loading: mocks.loading }))

// The page only decides what to show; the sections have their own tests.
mockComponent('AuthButton', async () => (await import('../helpers/stubs')).placeholder('auth-button'))
mockComponent('WalletCard', async () => (await import('../helpers/stubs')).placeholder('wallet-card'))
mockComponent('ManageSection', async () => (await import('../helpers/stubs')).placeholder('manage-section'))
mockComponent('ExpenseSection', async () => (await import('../helpers/stubs')).placeholder('expense-section'))

const sections = ['auth-button', 'wallet-card', 'manage-section', 'expense-section']

const visibleSections = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  sections.filter(name => wrapper.find(`[data-testid="${name}"]`).exists())

beforeEach(() => {
  mocks.user = ref(null)
  mocks.loading = ref(false)
})

describe('index page', () => {
  it('shows only a loader while auth settles', async () => {
    mocks.loading.value = true
    const wrapper = await mountSuspended(IndexPage)

    expect(visibleSections(wrapper)).toEqual([])
    expect(wrapper.text()).not.toContain('Welcome to Spendy')
  })

  it('welcomes signed-out visitors with the sign-in button', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.find('.welcome-title').text()).toBe('Welcome to Spendy')
    expect(visibleSections(wrapper)).toEqual(['auth-button'])
  })

  it('shows the dashboard once signed in', async () => {
    mocks.user.value = { uid: 'u1' }
    const wrapper = await mountSuspended(IndexPage)

    expect(visibleSections(wrapper)).toEqual(['wallet-card', 'manage-section', 'expense-section'])
    expect(wrapper.text()).not.toContain('Welcome to Spendy')
  })
})
