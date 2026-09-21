import { initializeApp, getApp, getApps } from 'firebase/app'
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  type Auth
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, type Analytics } from 'firebase/analytics'

export default defineNuxtPlugin(() => {
  try {
    const config = useRuntimeConfig()

    // Check if all required environment variables are present
    const requiredVars = [
      'firebaseApiKey',
      'firebaseAuthDomain',
      'firebaseProjectId',
      'firebaseStorageBucket',
      'firebaseMessagingSenderId',
      'firebaseAppId'
    ]

    const missingVars = requiredVars.filter(varName => !config.public[varName])

    if (missingVars.length > 0) {
      console.error('Missing Firebase environment variables:', missingVars)
      console.error('Please create a .env file with your Firebase configuration')
      return {
        provide: {
          auth: null,
          db: null,
          analytics: null
        }
      }
    }

    const firebaseConfig = {
      apiKey: config.public.firebaseApiKey,
      authDomain: config.public.firebaseAuthDomain,
      projectId: config.public.firebaseProjectId,
      storageBucket: config.public.firebaseStorageBucket,
      messagingSenderId: config.public.firebaseMessagingSenderId,
      appId: config.public.firebaseAppId,
      measurementId: config.public.firebaseMeasurementId
    }

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

    // initializeAuth rather than getAuth so we can pin two things the default
    // setup leaves to chance:
    //
    //  - the persistence chain. getAuth prefers IndexedDB alone, and installed
    //    iOS web apps have their IndexedDB evicted aggressively, which signs
    //    people out between launches. localStorage is the fallback.
    //  - the popup/redirect resolver, which is otherwise loaded lazily. The
    //    redirect flow is now the primary path on mobile, so it should be wired
    //    up before the first click rather than during it.
    let auth: Auth
    try {
      auth = initializeAuth(app, {
        persistence: [
          indexedDBLocalPersistence,
          browserLocalPersistence,
          browserSessionPersistence
        ],
        popupRedirectResolver: browserPopupRedirectResolver
      })
    } catch {
      // Already initialised - happens on hot reload.
      auth = getAuth(app)
    }

    const db = getFirestore(app)

    // Analytics is optional and must never take auth down with it. getAnalytics
    // throws where cookies or IndexedDB are unavailable, which is exactly the
    // kind of browser where sign-in is already fragile - and the old catch-all
    // below turned that throw into "Sign-in is unavailable right now".
    let analytics: Analytics | null = null
    if (import.meta.client && firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app)
      } catch (analyticsError) {
        console.warn('Firebase Analytics unavailable:', analyticsError)
      }
    }

    return {
      provide: {
        auth,
        db,
        analytics
      }
    }
  } catch (error) {
    console.error('Firebase initialization error:', error)
    return {
      provide: {
        auth: null,
        db: null,
        analytics: null
      }
    }
  }
})
