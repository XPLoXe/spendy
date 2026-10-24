import { vi, type Mock } from 'vitest'

type Doc = { id: string } & Record<string, unknown>
type Listener = { name: string, constraints: unknown[], callback: (docs: Doc[]) => void, unsubscribe: Mock }

/**
 * Stand-in for useFirestore(). Writes resolve immediately, and live
 * subscriptions are kept so a test can push a snapshot with `emit`.
 */
export const createFirestoreMock = () => {
  const listeners: Listener[] = []

  return {
    listeners,
    addDocument: vi.fn<(collection: string, data: object) => Promise<string>>(async () => 'new-id'),
    updateDocument: vi.fn<(collection: string, id: string, data: object) => Promise<void>>(async () => {}),
    deleteDocument: vi.fn<(collection: string, id: string) => Promise<void>>(async () => {}),
    getDocuments: vi.fn<(collection: string, constraints?: unknown[]) => Promise<Doc[]>>(async () => []),
    subscribeToCollection: vi.fn((name: string, constraints: unknown[], callback: (docs: Doc[]) => void) => {
      const unsubscribe = vi.fn()
      listeners.push({ name, constraints, callback, unsubscribe })
      return unsubscribe
    }),
    // Deliver a snapshot to every live listener on a collection.
    emit (name: string, docs: Doc[]) {
      listeners.filter(listener => listener.name === name).forEach(listener => listener.callback(docs))
    }
  }
}

export type FirestoreMock = ReturnType<typeof createFirestoreMock>
