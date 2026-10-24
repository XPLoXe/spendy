import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import * as firebaseApp from 'firebase/app'
import * as firebaseAuth from 'firebase/auth'
import * as firestore from 'firebase/firestore'
import * as analytics from 'firebase/analytics'
import firebasePlugin from '~/plugins/firebase.client'

const mocks = vi.hoisted(() => ({ publicConfig: {} as Record<string, string | undefined> }))

mockNuxtImport('useRuntimeConfig', original => () => ({ ...original(), public: mocks.publicConfig }))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ app: 'new' })),
  getApp: vi.fn(() => ({ app: 'existing' })),
  getApps: vi.fn(() => [])
}))

vi.mock('firebase/auth', () => ({
  initializeAuth: vi.fn(() => ({ auth: 'initialised' })),
  getAuth: vi.fn(() => ({ auth: 'existing' })),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
  indexedDBLocalPersistence: 'indexedDB',
  browserPopupRedirectResolver: 'resolver'
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ db: true }))
}))

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({ analytics: true }))
}))

const FULL_CONFIG = {
  firebaseApiKey: 'key',
  firebaseAuthDomain: 'spendy.example.com',
  firebaseProjectId: 'spendy',
  firebaseStorageBucket: 'bucket',
  firebaseMessagingSenderId: 'sender',
  firebaseAppId: 'app-id',
  firebaseMeasurementId: 'G-123'
}

const NOT_CONFIGURED = { provide: { auth: null, db: null, analytics: null } }

const runPlugin = async () =>
  await (firebasePlugin as unknown as (app: unknown) => Promise<{ provide: Record<string, unknown> }>)(useNuxtApp())

beforeEach(() => {
  mocks.publicConfig = { ...FULL_CONFIG }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

describe('firebase plugin', () => {
  it('initialises Firebase from the runtime config', async () => {
    const { provide } = await runPlugin()

    expect(firebaseApp.initializeApp).toHaveBeenCalledWith({
      apiKey: 'key',
      authDomain: 'spendy.example.com',
      projectId: 'spendy',
      storageBucket: 'bucket',
      messagingSenderId: 'sender',
      appId: 'app-id',
      measurementId: 'G-123'
    })
    expect(provide).toEqual({
      auth: { auth: 'initialised' },
      db: { db: true },
      analytics: { analytics: true }
    })
  })

  it('pins the persistence chain and the popup/redirect resolver', async () => {
    await runPlugin()

    expect(firebaseAuth.initializeAuth).toHaveBeenCalledWith({ app: 'new' }, {
      persistence: ['indexedDB', 'local', 'session'],
      popupRedirectResolver: 'resolver'
    })
  })

  it('reuses an app that is already initialised', async () => {
    vi.mocked(firebaseApp.getApps).mockReturnValue([{}] as never)

    await runPlugin()

    expect(firebaseApp.initializeApp).not.toHaveBeenCalled()
    expect(firestore.getFirestore).toHaveBeenCalledWith({ app: 'existing' })
  })

  it('falls back to the existing Auth instance after a hot reload', async () => {
    vi.mocked(firebaseAuth.initializeAuth).mockImplementation(() => {
      throw new Error('auth/already-initialized')
    })

    const { provide } = await runPlugin()

    expect(provide.auth).toEqual({ auth: 'existing' })
  })

  it.each([
    'firebaseApiKey',
    'firebaseAuthDomain',
    'firebaseProjectId',
    'firebaseStorageBucket',
    'firebaseMessagingSenderId',
    'firebaseAppId'
  ])('provides nothing when %s is missing', async (name) => {
    mocks.publicConfig[name] = ''

    expect(await runPlugin()).toEqual(NOT_CONFIGURED)
    expect(console.error).toHaveBeenCalledWith('Missing Firebase environment variables:', [name])
    expect(firebaseApp.initializeApp).not.toHaveBeenCalled()
  })

  it('skips Analytics without a measurement id', async () => {
    mocks.publicConfig.firebaseMeasurementId = undefined

    const { provide } = await runPlugin()

    expect(analytics.getAnalytics).not.toHaveBeenCalled()
    expect(provide.analytics).toBeNull()
    expect(provide.auth).toEqual({ auth: 'initialised' })
  })

  it('keeps Auth working when Analytics is unavailable', async () => {
    vi.mocked(analytics.getAnalytics).mockImplementation(() => {
      throw new Error('cookies disabled')
    })

    const { provide } = await runPlugin()

    expect(provide.analytics).toBeNull()
    expect(provide.auth).toEqual({ auth: 'initialised' })
    expect(console.warn).toHaveBeenCalled()
  })

  it('provides nothing when initialisation fails', async () => {
    vi.mocked(firestore.getFirestore).mockImplementation(() => {
      throw new Error('bad config')
    })

    expect(await runPlugin()).toEqual(NOT_CONFIGURED)
    expect(console.error).toHaveBeenCalledWith('Firebase initialization error:', expect.any(Error))
  })
})
