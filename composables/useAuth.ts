import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth'

// Records that we handed the browser over to Google. It has to survive a full
// page load - and, in an installed web app, a relaunch - so sessionStorage is
// not enough.
const REDIRECT_PENDING_KEY = 'spendy:auth:redirect-pending'

// The popup never had a chance to open (blockers). Retrying the same way is
// pointless, so these fall back to a full-page redirect instead.
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
])

// The person deliberately dismissed the popup, or a second click superseded the
// first. Neither is a failure worth showing them. We only get here from a real
// browser tab: contexts where a popup cannot work never open one, so a dismissal
// here really is a dismissal.
const SILENT = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request'
])

const MESSAGES: Record<string, string> = {
  'auth/missing-initial-state':
    'Sign-in lost its place on the way back from Google. Opening Spendy in Safari or Chrome should work in the meantime.',
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

// Firebase never came up at all - almost always a missing or incomplete .env.
// Clicking used to fall through to the catch-all "Something went wrong" message,
// which sends you looking for a sign-in bug instead of a config one.
const AUTH_UNAVAILABLE =
  'Sign-in is unavailable right now. Please try again later.'

// How long to wait for the browser to act on signInWithRedirect before deciding
// it never will. Normally the page is gone long before this fires.
const REDIRECT_NAVIGATION_TIMEOUT = 20000

// Shown when we sent someone to Google and they came back with nothing. Firebase
// has no error code for this, so without it the app just redisplays the
// signed-out screen and the button looks like it did nothing at all.
const REDIRECT_RETURNED_EMPTY =
  'Sign-in did not finish. Please try again - and if it keeps failing, open Spendy in Safari or Chrome instead.'

const errorCodeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''

const messageFor = (error: unknown): string =>
  MESSAGES[errorCodeOf(error)] ||
  'Something went wrong signing you in. Please try again.'

/**
 * True when the page is running as an installed app rather than a browser tab.
 * iOS home-screen web apps answer `navigator.standalone`; every other platform
 * answers the display-mode media query.
 */
const isInstalledApp = (): boolean => {
  const nav = window.navigator as Navigator & { standalone?: boolean }

  if (nav.standalone === true) {
    return true
  }

  return ['standalone', 'fullscreen', 'minimal-ui'].some(
    mode => window.matchMedia(`(display-mode: ${mode})`).matches
  )
}

// Browsers embedded inside another app: WhatsApp, Instagram, Facebook, and
// friends. They hand window.open to a view that cannot reach its opener.
const EMBEDDED_WEBVIEW =
  /\b(FBAN|FBAV|FBIOS|FB_IAB|Instagram|Line|Twitter|LinkedInApp|WhatsApp|Snapchat|Pinterest|MicroMessenger)\b/i

const isEmbeddedWebView = (): boolean =>
  EMBEDDED_WEBVIEW.test(window.navigator.userAgent)

/**
 * signInWithPopup needs a child window that can postMessage back to us. An
 * installed iOS web app opens window.open in a separate browser sheet with no
 * opener, so Google loads, the person signs in, and the sheet has nobody to hand
 * the credential to. Dismissing it surfaces as auth/popup-closed-by-user, which
 * we treat as a deliberate cancel - hence a sign-in that fails in complete
 * silence. Those contexts must use the redirect flow from the start.
 */
const popupCanWork = (): boolean => !isInstalledApp() && !isEmbeddedWebView()

const rememberRedirectPending = () => {
  try {
    window.localStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()))
  } catch {
    // Storage denied (private mode, cookies off). The redirect still runs; we
    // just lose the ability to explain ourselves if it comes back empty.
  }
}

const forgetRedirectPending = () => {
  try {
    window.localStorage.removeItem(REDIRECT_PENDING_KEY)
  } catch {
    // See above.
  }
}

const consumeRedirectPending = (): boolean => {
  try {
    const pending = window.localStorage.getItem(REDIRECT_PENDING_KEY) !== null
    window.localStorage.removeItem(REDIRECT_PENDING_KEY)
    return pending
  } catch {
    return false
  }
}

export const useAuth = () => {
  const { $auth } = useNuxtApp()

  // Shared across every caller. Eight components call useAuth(); giving each its
  // own refs meant eight onAuthStateChanged listeners and, worse, eight
  // concurrent getRedirectResult() calls racing over the same one-shot redirect
  // state.
  const user = useState<User | null>('auth:user', () => null)
  const loading = useState<boolean>('auth:loading', () => true)
  const signingIn = useState<boolean>('auth:signingIn', () => false)
  const error = useState<string | null>('auth:error', () => null)
  const started = useState<boolean>('auth:started', () => false)

  const requireAuth = () => {
    if (!$auth) {
      throw new Error(
        'Firebase Auth is not initialized. Please check your .env file.'
      )
    }
    return $auth as Auth
  }

  const signInWithGoogle = async () => {
    if (!$auth) {
      error.value = AUTH_UNAVAILABLE
      console.error(
        'Firebase Auth is not initialized. Please check your .env file.'
      )
      return
    }

    error.value = null
    signingIn.value = true

    // Set once we are committed to navigating away, so the button keeps saying
    // "Signing in..." instead of snapping back while the page unloads.
    let leaving = false

    const goViaRedirect = async (auth: Auth, provider: GoogleAuthProvider) => {
      leaving = true
      rememberRedirectPending()
      await signInWithRedirect(auth, provider)

      // Still here? Then the navigation was swallowed - the button would sit on
      // "Signing in..." forever, which is exactly how the broken flow looked.
      // Hand it back with something to read instead.
      window.setTimeout(() => {
        if (!signingIn.value) {
          return
        }

        forgetRedirectPending()
        signingIn.value = false
        error.value = REDIRECT_RETURNED_EMPTY
      }, REDIRECT_NAVIGATION_TIMEOUT)
    }

    try {
      const auth = requireAuth()
      const provider = new GoogleAuthProvider()

      if (!popupCanWork()) {
        await goViaRedirect(auth, provider)
        return
      }

      try {
        await signInWithPopup(auth, provider)
      } catch (popupError) {
        const code = errorCodeOf(popupError)

        if (SILENT.has(code)) {
          return
        }

        if (POPUP_UNAVAILABLE.has(code)) {
          error.value = MESSAGES[code] || null
          await goViaRedirect(auth, provider)
          return
        }

        throw popupError
      }
    } catch (caught) {
      leaving = false
      forgetRedirectPending()
      console.error('Error signing in with Google:', caught)
      error.value = messageFor(caught)
    } finally {
      if (!leaving) {
        signingIn.value = false
      }
    }
  }

  const logout = async () => {
    error.value = null
    forgetRedirectPending()

    try {
      await signOut(requireAuth())
    } catch (caught) {
      console.error('Error signing out:', caught)
      error.value = 'Could not sign you out. Please try again.'
    }
  }

  const start = async () => {
    if (!$auth) {
      loading.value = false
      error.value = AUTH_UNAVAILABLE
      console.error(
        'Firebase Auth is not initialized. Please check your .env file.'
      )
      return
    }

    const auth = $auth as Auth
    const returningFromRedirect = consumeRedirectPending()

    // Coming back from Google we keep the app in its loading state until
    // getRedirectResult has had its say. Painting the signed-out welcome screen
    // first is what made a working redirect look like a failed sign-in.
    signingIn.value = returningFromRedirect

    onAuthStateChanged(auth, (firebaseUser) => {
      // markRaw keeps Vue from deep-proxying the Firebase user object, which
      // would hand a proxy back to the SDK on every currentUser comparison.
      user.value = firebaseUser ? markRaw(firebaseUser) : null

      if (firebaseUser) {
        signingIn.value = false
        error.value = null
      }

      if (!returningFromRedirect) {
        loading.value = false
      }
    })

    try {
      const result = await getRedirectResult(auth)

      if (!result && returningFromRedirect && !auth.currentUser) {
        error.value = REDIRECT_RETURNED_EMPTY
      }
    } catch (caught) {
      console.error('Error completing redirect sign-in:', caught)
      error.value = messageFor(caught)
    } finally {
      signingIn.value = false
      loading.value = false
    }
  }

  onMounted(() => {
    if (started.value) {
      return
    }

    started.value = true
    void start()
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
