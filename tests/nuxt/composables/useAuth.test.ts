import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h, isReactive } from 'vue'
import * as firebaseAuth from 'firebase/auth'
import { useAuth } from '~/composables/useAuth'

const mocks = vi.hoisted(() => ({ auth: null as null | { currentUser: unknown } }))

// The real app, with the Firebase Auth instance swapped for a test double.
mockNuxtImport('useNuxtApp', original => () => new Proxy(original(), {
  get: (target, key) => key === '$auth' ? mocks.auth : Reflect.get(target, key)
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider () {}),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
}))

const REDIRECT_PENDING_KEY = 'spendy:auth:redirect-pending'
const AUTH_UNAVAILABLE = 'Sign-in is unavailable right now. Please try again later.'
const REDIRECT_RETURNED_EMPTY = 'Sign-in did not finish. Please try again - and if it keeps failing, open Spendy in Safari or Chrome instead.'
const GENERIC_ERROR = 'Something went wrong signing you in. Please try again.'
const AUTH_STATE_KEYS = ['auth:user', 'auth:loading', 'auth:signingIn', 'auth:error', 'auth:started']

const authError = (code: string) => Object.assign(new Error(code), { code })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// useAuth starts listening in onMounted, so it has to run inside a component.
const mountAuth = async () => {
  let auth!: ReturnType<typeof useAuth>
  await mountSuspended(defineComponent({
    setup () {
      auth = useAuth()
      return () => h('div')
    }
  }))
  await flushPromises()
  return auth
}

const authStateListener = () =>
  vi.mocked(firebaseAuth.onAuthStateChanged).mock.calls.at(-1)![1] as (user: unknown) => void

const runAs = ({ standalone = false, displayMode = false, userAgent = 'Mozilla/5.0 Chrome/130' } = {}) => {
  Object.defineProperty(window.navigator, 'standalone', { value: standalone, configurable: true })
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: displayMode && query === '(display-mode: standalone)'
  }) as MediaQueryList)
}

beforeEach(() => {
  clearNuxtState(AUTH_STATE_KEYS)
  window.localStorage.clear()
  mocks.auth = { currentUser: null }
  runAs()
  vi.mocked(firebaseAuth.getRedirectResult).mockResolvedValue(null)
  vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue({} as never)
  vi.mocked(firebaseAuth.signInWithRedirect).mockResolvedValue(undefined as never)
  vi.mocked(firebaseAuth.signOut).mockResolvedValue()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  describe('start-up', () => {
    it('reports sign-in as unavailable when Firebase Auth is missing', async () => {
      mocks.auth = null

      const { loading, error } = await mountAuth()

      expect(loading.value).toBe(false)
      expect(error.value).toBe(AUTH_UNAVAILABLE)
      expect(firebaseAuth.onAuthStateChanged).not.toHaveBeenCalled()
    })

    it('stores the signed-in user without making it reactive', async () => {
      const { user, loading } = await mountAuth()
      const firebaseUser = { uid: 'u1', displayName: 'Ana' }

      authStateListener()(firebaseUser)

      expect(user.value).toStrictEqual(firebaseUser)
      expect(isReactive(user.value)).toBe(false)
      expect(loading.value).toBe(false)
    })

    it('clears the user on sign-out', async () => {
      const { user } = await mountAuth()

      authStateListener()({ uid: 'u1' })
      authStateListener()(null)

      expect(user.value).toBeNull()
    })

    it('listens only once however many components use it', async () => {
      await mountAuth()
      await mountAuth()

      expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalledTimes(1)
      expect(firebaseAuth.getRedirectResult).toHaveBeenCalledTimes(1)
    })

    it('stays loading after a redirect until Firebase has the result', async () => {
      window.localStorage.setItem(REDIRECT_PENDING_KEY, '1')
      const redirect = deferred<null>()
      vi.mocked(firebaseAuth.getRedirectResult).mockReturnValue(redirect.promise as never)

      const { loading, signingIn } = await mountAuth()
      authStateListener()(null)

      expect(loading.value).toBe(true)
      expect(signingIn.value).toBe(true)

      mocks.auth!.currentUser = { uid: 'u1' }
      redirect.resolve(null)
      await flushPromises()

      expect(loading.value).toBe(false)
      expect(signingIn.value).toBe(false)
      expect(window.localStorage.getItem(REDIRECT_PENDING_KEY)).toBeNull()
    })

    it('explains a redirect that came back without a user', async () => {
      window.localStorage.setItem(REDIRECT_PENDING_KEY, '1')

      const { error } = await mountAuth()

      expect(error.value).toBe(REDIRECT_RETURNED_EMPTY)
    })

    it('stays quiet when no redirect was pending', async () => {
      const { error } = await mountAuth()

      expect(error.value).toBeNull()
    })

    it('shows a friendly message when the redirect fails', async () => {
      vi.mocked(firebaseAuth.getRedirectResult).mockRejectedValue(authError('auth/network-request-failed'))

      const { error, loading } = await mountAuth()

      expect(error.value).toBe('Could not reach the sign-in service. Check your connection and try again.')
      expect(loading.value).toBe(false)
    })

    it('falls back to a generic message for unknown errors', async () => {
      vi.mocked(firebaseAuth.getRedirectResult).mockRejectedValue(new Error('boom'))

      const { error } = await mountAuth()

      expect(error.value).toBe(GENERIC_ERROR)
    })

    it('clears a previous error once a user signs in', async () => {
      vi.mocked(firebaseAuth.getRedirectResult).mockRejectedValue(new Error('boom'))
      const { error } = await mountAuth()

      authStateListener()({ uid: 'u1' })

      expect(error.value).toBeNull()
    })
  })

  describe('signInWithGoogle', () => {
    it('reports sign-in as unavailable when Firebase Auth is missing', async () => {
      mocks.auth = null
      const { signInWithGoogle, signingIn, error } = await mountAuth()

      await signInWithGoogle()

      expect(error.value).toBe(AUTH_UNAVAILABLE)
      expect(signingIn.value).toBe(false)
      expect(firebaseAuth.signInWithPopup).not.toHaveBeenCalled()
    })

    it('signs in through a popup in a normal browser tab', async () => {
      const { signInWithGoogle, signingIn, error } = await mountAuth()

      await signInWithGoogle()

      expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(mocks.auth, expect.any(firebaseAuth.GoogleAuthProvider))
      expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled()
      expect(signingIn.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('shows that sign-in is in progress while the popup is open', async () => {
      const popup = deferred<never>()
      vi.mocked(firebaseAuth.signInWithPopup).mockReturnValue(popup.promise)
      const { signInWithGoogle, signingIn } = await mountAuth()

      const running = signInWithGoogle()
      expect(signingIn.value).toBe(true)

      popup.resolve({} as never)
      await running
      expect(signingIn.value).toBe(false)
    })

    it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
      'treats %s as a deliberate cancel',
      async (code) => {
        vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(authError(code))
        const { signInWithGoogle, signingIn, error } = await mountAuth()

        await signInWithGoogle()

        expect(error.value).toBeNull()
        expect(signingIn.value).toBe(false)
        expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled()
      }
    )

    it('falls back to a redirect when the popup is blocked', async () => {
      vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(authError('auth/popup-blocked'))
      const { signInWithGoogle, signingIn, error } = await mountAuth()

      await signInWithGoogle()

      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalledWith(mocks.auth, expect.any(firebaseAuth.GoogleAuthProvider))
      expect(error.value).toBe('Your browser blocked the sign-in window. Redirecting you instead.')
      // The page is about to unload, so the button keeps its busy state.
      expect(signingIn.value).toBe(true)
      expect(window.localStorage.getItem(REDIRECT_PENDING_KEY)).not.toBeNull()
    })

    it('falls back to a redirect where popups are not supported', async () => {
      vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(authError('auth/operation-not-supported-in-this-environment'))
      const { signInWithGoogle, error } = await mountAuth()

      await signInWithGoogle()

      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled()
      expect(error.value).toBeNull()
    })

    it('shows a friendly message for other popup errors', async () => {
      vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(authError('auth/too-many-requests'))
      const { signInWithGoogle, signingIn, error } = await mountAuth()

      await signInWithGoogle()

      expect(error.value).toBe('Too many attempts. Please wait a moment and try again.')
      expect(signingIn.value).toBe(false)
    })

    it.each([
      ['an installed iOS web app', { standalone: true }],
      ['an installed web app', { displayMode: true }],
      ['an in-app browser', { userAgent: 'Mozilla/5.0 (iPhone) Instagram 300.0' }]
    ])('goes straight to a redirect in %s', async (_context, context) => {
      runAs(context)
      const { signInWithGoogle, signingIn } = await mountAuth()

      await signInWithGoogle()

      expect(firebaseAuth.signInWithPopup).not.toHaveBeenCalled()
      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled()
      expect(signingIn.value).toBe(true)
    })

    it('gives the button back if the redirect never navigates away', async () => {
      runAs({ standalone: true })
      const { signInWithGoogle, signingIn, error } = await mountAuth()
      vi.useFakeTimers({ toFake: ['setTimeout'] })

      await signInWithGoogle()
      vi.advanceTimersByTime(19_999)
      expect(signingIn.value).toBe(true)

      vi.advanceTimersByTime(1)
      expect(signingIn.value).toBe(false)
      expect(error.value).toBe(REDIRECT_RETURNED_EMPTY)
      expect(window.localStorage.getItem(REDIRECT_PENDING_KEY)).toBeNull()
    })

    it('recovers when starting the redirect fails', async () => {
      runAs({ standalone: true })
      vi.mocked(firebaseAuth.signInWithRedirect).mockRejectedValue(authError('auth/unauthorized-domain'))
      const { signInWithGoogle, signingIn, error } = await mountAuth()

      await signInWithGoogle()

      expect(error.value).toBe('This address is not authorised for sign-in. Please report this to the Spendy team.')
      expect(signingIn.value).toBe(false)
      expect(window.localStorage.getItem(REDIRECT_PENDING_KEY)).toBeNull()
    })

    it('still redirects when storage is unavailable', async () => {
      runAs({ standalone: true })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      const { signInWithGoogle } = await mountAuth()

      await signInWithGoogle()

      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('signs out and forgets any pending redirect', async () => {
      const { logout, error } = await mountAuth()
      window.localStorage.setItem(REDIRECT_PENDING_KEY, '1')

      await logout()

      expect(firebaseAuth.signOut).toHaveBeenCalledWith(mocks.auth)
      expect(window.localStorage.getItem(REDIRECT_PENDING_KEY)).toBeNull()
      expect(error.value).toBeNull()
    })

    it('explains a failed sign-out', async () => {
      vi.mocked(firebaseAuth.signOut).mockRejectedValue(new Error('offline'))
      const { logout, error } = await mountAuth()

      await logout()

      expect(error.value).toBe('Could not sign you out. Please try again.')
    })
  })
})
