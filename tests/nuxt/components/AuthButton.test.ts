import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, type Ref } from 'vue'
import AuthButton from '~/components/AuthButton.vue'
import { findButton } from '../helpers/dom'

type FakeUser = { displayName?: string | null, email?: string | null, photoURL?: string | null }

const mocks = vi.hoisted(() => ({
  auth: undefined as unknown as {
    user: Ref<FakeUser | null>
    loading: Ref<boolean>
    signingIn: Ref<boolean>
    error: Ref<string | null>
    signInWithGoogle: ReturnType<typeof vi.fn>
    logout: ReturnType<typeof vi.fn>
  }
}))

mockNuxtImport('useAuth', () => () => mocks.auth)
mockComponent('UDropdownMenu', async () => (await import('../helpers/stubs')).DropdownMenuStub)

beforeEach(() => {
  mocks.auth = {
    user: ref(null),
    loading: ref(false),
    signingIn: ref(false),
    error: ref(null),
    signInWithGoogle: vi.fn(),
    logout: vi.fn()
  }
})

describe('AuthButton', () => {
  it('shows only a spinner while auth is loading', async () => {
    mocks.auth.loading.value = true
    const wrapper = await mountSuspended(AuthButton)

    expect(wrapper.find('.auth-loading').exists()).toBe(true)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  describe('signed out', () => {
    it('offers Google sign-in', async () => {
      const wrapper = await mountSuspended(AuthButton)

      await findButton(wrapper, 'Sign in with Google').trigger('click')

      expect(mocks.auth.signInWithGoogle).toHaveBeenCalledTimes(1)
    })

    it('uses the short label in the navbar', async () => {
      const wrapper = await mountSuspended(AuthButton, { props: { compact: true } })

      const button = findButton(wrapper, 'Sign in')
      expect(button.classes()).toContain('auth-signin-compact')
    })

    it('disables the button while signing in', async () => {
      mocks.auth.signingIn.value = true
      const wrapper = await mountSuspended(AuthButton, { props: { compact: true } })

      expect(findButton(wrapper, 'Signing in...').attributes('disabled')).toBeDefined()
    })
  })

  describe('errors', () => {
    it('shows the sign-in error', async () => {
      mocks.auth.error.value = 'Too many attempts.'
      const wrapper = await mountSuspended(AuthButton)

      expect(wrapper.find('[role="alert"]').text()).toContain('Too many attempts.')
    })

    it('leaves the error to another instance when asked', async () => {
      mocks.auth.error.value = 'Too many attempts.'
      const wrapper = await mountSuspended(AuthButton, { props: { showError: false } })

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })
  })

  describe('signed in', () => {
    it('opens an account menu with the user\'s name', async () => {
      mocks.auth.user.value = { displayName: 'Ana Pérez', email: 'ana@example.com', photoURL: 'https://example.com/a.png' }
      const wrapper = await mountSuspended(AuthButton)

      expect(findButton(wrapper, 'Account menu for Ana Pérez').exists()).toBe(true)
      expect(wrapper.find('[data-testid="dropdown"]').text()).toContain('Ana Pérez')
      expect(wrapper.find('img').attributes('src')).toBe('https://example.com/a.png')
    })

    it.each([
      [{ displayName: null, email: 'ana@example.com' }, 'ana@example.com'],
      [{ displayName: null, email: null }, 'User']
    ])('falls back from the display name (%o)', async (user, name) => {
      mocks.auth.user.value = user
      const wrapper = await mountSuspended(AuthButton)

      expect(findButton(wrapper, `Account menu for ${name}`).exists()).toBe(true)
    })

    it('logs out from the menu', async () => {
      mocks.auth.user.value = { displayName: 'Ana' }
      const wrapper = await mountSuspended(AuthButton)

      await findButton(wrapper, 'Logout').trigger('click')

      expect(mocks.auth.logout).toHaveBeenCalledTimes(1)
    })
  })
})
