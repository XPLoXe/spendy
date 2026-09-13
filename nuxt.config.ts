// https://nuxt.com/docs/api/configuration/nuxt-config

// Firebase serves the Google OAuth handler from <projectId>.firebaseapp.com.
// Left as-is that origin is third-party to this app, so iOS in-app browsers and
// Safari with cross-site tracking prevention partition (or block) its
// sessionStorage. The handler then loses the state it wrote before bouncing to
// Google and fails with auth/missing-initial-state.
//
// The route rule below reverse-proxies the handler under our own domain, so it
// becomes same-origin with the app. FIREBASE_AUTH_DOMAIN must then be set to
// this app's domain rather than <projectId>.firebaseapp.com.
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'spendy-1afd9'
const authHandlerOrigin = `https://${firebaseProjectId}.firebaseapp.com`

export default defineNuxtConfig({
  nitro: { preset: 'vercel' },
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  routeRules: {
    '/__/auth/**': { proxy: `${authHandlerOrigin}/__/auth/**` }
  },
  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID
    }
  }
})
