import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import * as firestore from 'firebase/firestore'
import { useFirestore } from '~/composables/useFirestore'

const mocks = vi.hoisted(() => ({ db: {} as unknown }))

// The real app, with the Firestore instance swapped for a test double.
mockNuxtImport('useNuxtApp', original => () => new Proxy(original(), {
  get: (target, key) => key === '$db' ? mocks.db : Reflect.get(target, key)
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ doc: `${name}/${id}` })),
  query: vi.fn((ref: object, ...constraints: unknown[]) => ({ ...ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn()
}))

const snapshot = (docs: Record<string, Record<string, unknown>>) => ({
  docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data }))
})

const NOW = new Date(2026, 4, 15, 12)
const NOT_INITIALISED = 'Firebase Firestore is not initialized. Please check your .env file.'

beforeEach(() => {
  mocks.db = { name: 'test-db' }
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

describe('useFirestore', () => {
  describe('addDocument', () => {
    it('adds the data with timestamps and returns the new id', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValue({ id: 'new-id' } as never)

      const id = await useFirestore().addDocument('expenses', { amount: 5 })

      expect(id).toBe('new-id')
      expect(firestore.collection).toHaveBeenCalledWith(mocks.db, 'expenses')
      expect(firestore.addDoc).toHaveBeenCalledWith(
        { collection: 'expenses' },
        { createdAt: NOW, updatedAt: NOW, amount: 5 }
      )
    })

    it('keeps a createdAt passed in by the caller', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValue({ id: 'new-id' } as never)
      const createdAt = new Date(2026, 0, 1)

      await useFirestore().addDocument('expenses', { createdAt })

      expect(vi.mocked(firestore.addDoc).mock.calls[0]![1]).toMatchObject({ createdAt, updatedAt: NOW })
    })

    it('rethrows and logs Firestore errors', async () => {
      const failure = new Error('permission-denied')
      vi.mocked(firestore.addDoc).mockRejectedValue(failure)

      await expect(useFirestore().addDocument('expenses', {})).rejects.toBe(failure)
      expect(console.error).toHaveBeenCalledWith('Error adding document:', failure)
    })
  })

  describe('updateDocument', () => {
    it('updates the document and its updatedAt', async () => {
      await useFirestore().updateDocument('expenses', 'e1', { amount: 7, updatedAt: 'stale' })

      expect(firestore.doc).toHaveBeenCalledWith(mocks.db, 'expenses', 'e1')
      expect(firestore.updateDoc).toHaveBeenCalledWith({ doc: 'expenses/e1' }, { amount: 7, updatedAt: NOW })
    })

    it('rethrows and logs Firestore errors', async () => {
      const failure = new Error('not-found')
      vi.mocked(firestore.updateDoc).mockRejectedValue(failure)

      await expect(useFirestore().updateDocument('expenses', 'e1', {})).rejects.toBe(failure)
      expect(console.error).toHaveBeenCalledWith('Error updating document:', failure)
    })
  })

  describe('deleteDocument', () => {
    it('deletes the document', async () => {
      await useFirestore().deleteDocument('expenses', 'e1')

      expect(firestore.deleteDoc).toHaveBeenCalledWith({ doc: 'expenses/e1' })
    })

    it('rethrows and logs Firestore errors', async () => {
      const failure = new Error('not-found')
      vi.mocked(firestore.deleteDoc).mockRejectedValue(failure)

      await expect(useFirestore().deleteDocument('expenses', 'e1')).rejects.toBe(failure)
      expect(console.error).toHaveBeenCalledWith('Error deleting document:', failure)
    })
  })

  describe('getDocuments', () => {
    it('returns every document with its id', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue(snapshot({ a: { amount: 1 }, b: { amount: 2 } }) as never)

      const docs = await useFirestore().getDocuments('expenses')

      expect(firestore.query).not.toHaveBeenCalled()
      expect(firestore.getDocs).toHaveBeenCalledWith({ collection: 'expenses' })
      expect(docs).toEqual([{ id: 'a', amount: 1 }, { id: 'b', amount: 2 }])
    })

    it('queries with the given constraints', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue(snapshot({}) as never)
      const constraint = { field: 'userId', op: '==', value: 'u1' }

      await useFirestore().getDocuments('expenses', [constraint])

      expect(firestore.getDocs).toHaveBeenCalledWith({ collection: 'expenses', constraints: [constraint] })
    })

    it('rethrows and logs Firestore errors', async () => {
      const failure = new Error('unavailable')
      vi.mocked(firestore.getDocs).mockRejectedValue(failure)

      await expect(useFirestore().getDocuments('expenses')).rejects.toBe(failure)
      expect(console.error).toHaveBeenCalledWith('Error getting documents:', failure)
    })
  })

  describe('subscribeToCollection', () => {
    it('passes each snapshot to the callback and returns the unsubscribe function', () => {
      const unsubscribe = vi.fn()
      vi.mocked(firestore.onSnapshot).mockReturnValue(unsubscribe)
      const callback = vi.fn()
      const constraint = { field: 'userId', op: '==', value: 'u1' }

      const result = useFirestore().subscribeToCollection('categories', [constraint], callback)

      expect(result).toBe(unsubscribe)
      const [ref, listener] = vi.mocked(firestore.onSnapshot).mock.calls[0]! as unknown as [unknown, (s: unknown) => void]
      expect(ref).toEqual({ collection: 'categories', constraints: [constraint] })

      listener(snapshot({ c1: { name: 'Food' } }))
      expect(callback).toHaveBeenCalledWith([{ id: 'c1', name: 'Food' }])
    })

    it('listens to the whole collection without constraints', () => {
      useFirestore().subscribeToCollection('categories', [], vi.fn())

      expect(firestore.onSnapshot).toHaveBeenCalledWith({ collection: 'categories' }, expect.any(Function))
    })
  })

  describe('without Firestore', () => {
    beforeEach(() => {
      mocks.db = null
    })

    it.each([
      ['addDocument', () => useFirestore().addDocument('expenses', {})],
      ['updateDocument', () => useFirestore().updateDocument('expenses', 'e1', {})],
      ['deleteDocument', () => useFirestore().deleteDocument('expenses', 'e1')],
      ['getDocuments', () => useFirestore().getDocuments('expenses')]
    ])('%s explains the missing configuration', async (_name, call) => {
      await expect(call()).rejects.toThrow(NOT_INITIALISED)
    })

    it('subscribeToCollection logs and returns a no-op unsubscribe', () => {
      const unsubscribe = useFirestore().subscribeToCollection('expenses', [], vi.fn())

      expect(firestore.onSnapshot).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith(NOT_INITIALISED)
      expect(() => unsubscribe()).not.toThrow()
    })
  })
})
