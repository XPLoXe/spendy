import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'

// The popup never had a chance to open (in-app webviews, blockers). Retrying the
// same way is pointless, so these fall back to a full-page redirect instead.
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
])

// The person deliberately dismissed the popup, or a second click superseded the
// first. Neither is a failure worth showing them.
const SILENT = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request'
])

const MESSAGES: Record<string, string> = {
  'auth/missing-initial-state':
    'Your browser blocked the storage the sign-in window needs. Open Spendy directly in Safari or Chrome rather than inside another app, then try again.',
  'auth/web-storage-unsupported':
    'Your browser has cookies or site data turned off, which sign-in requires. Enable them and try again.',
  'auth/network-request-failed':
    'Could not reach the sign-in service. Check your connection and try again.',
  'auth/unauthorized-domain':
    'This address is not authorised for sign-in. Please report this to the Spendy team.',
  'auth/too-many-requests':
    'Too many attempts. Please wait a moment and try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in window. Redirecting you instead.'
}

const errorCodeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''

const messageFor = (error: unknown): string =>
  MESSAGES[errorCodeOf(error)] ||
  'Something went wrong signing you in. Please try again.'

export const useAuth = () => {
  const { $auth } = useNuxtApp()
  const user = ref<User | null>(null)
  const loading = ref(true)
  const signingIn = ref(false)
  const error = ref<string | null>(null)

  const requireAuth = () => {
    if (!$auth) {
      throw new Error(
        'Firebase Auth is not initialized. Please check your .env file.'
      )
    }
    return $auth
  }

  const signInWithGoogle = async () => {
    error.value = null
    signingIn.value = true

    try {
      const auth = requireAuth()
      const provider = new GoogleAuthProvider()

      try {
        await signInWithPopup(auth, provider)
      } catch (popupError) {
        const code = errorCodeOf(popupError)

        if (SILENT.has(code)) {
          return
        }

        if (POPUP_UNAVAILABLE.has(code)) {
          // Leaves the page, so signingIn stays true until we navigate away.
          await signInWithRedirect(auth, provider)
          return
        }

        throw popupError
      }
    } catch (caught) {
      console.error('Error signing in with Google:', caught)
      error.value = messageFor(caught)
    } finally {
      signingIn.value = false
    }
  }

  const logout = async () => {
    error.value = null

    try {
      await signOut(requireAuth())
    } catch (caught) {
      console.error('Error signing out:', caught)
      error.value = 'Could not sign you out. Please try again.'
    }
  }

  onMounted(async () => {
    if (!$auth) {
      loading.value = false
      error.value =
        'Sign-in is unavailable right now. Please try again later.'
      console.error(
        'Firebase Auth is not initialized. Please check your .env file.'
      )
      return
    }

    onAuthStateChanged($auth, (firebaseUser) => {
      user.value = firebaseUser
      loading.value = false
    })

    // Surfaces failures from the redirect fallback, which would otherwise be
    // swallowed and leave the button looking inert.
    try {
      await getRedirectResult($auth)
    } catch (caught) {
      console.error('Error completing redirect sign-in:', caught)
      error.value = messageFor(caught)
    }
  })

  return {
    user: readonly(user),
    loading: readonly(loading),
    signingIn: readonly(signingIn),
    error: readonly(error),
    signInWithGoogle,
    logout
  }
}
