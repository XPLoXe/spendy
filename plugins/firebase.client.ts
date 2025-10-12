import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

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

    const app = initializeApp(firebaseConfig)
    const auth = getAuth(app)
    const db = getFirestore(app)

    // Initialize analytics only on client side
    let analytics = null
    if (process.client) {
      analytics = getAnalytics(app)
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
