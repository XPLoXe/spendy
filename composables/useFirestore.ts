import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  type DocumentData,
  type QuerySnapshot
} from 'firebase/firestore'

export const useFirestore = () => {
  const { $db } = useNuxtApp()

  const addDocument = async (collectionName: string, data: any) => {
    if (!$db) {
      throw new Error('Firebase Firestore is not initialized. Please check your .env file.')
    }
    
    try {
      const docRef = await addDoc(collection($db, collectionName), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      return docRef.id
    } catch (error) {
      console.error('Error adding document:', error)
      throw error
    }
  }

  const updateDocument = async (collectionName: string, docId: string, data: any) => {
    if (!$db) {
      throw new Error('Firebase Firestore is not initialized. Please check your .env file.')
    }
    
    try {
      await updateDoc(doc($db, collectionName, docId), {
        ...data,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  const deleteDocument = async (collectionName: string, docId: string) => {
    if (!$db) {
      throw new Error('Firebase Firestore is not initialized. Please check your .env file.')
    }
    
    try {
      await deleteDoc(doc($db, collectionName, docId))
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  const getDocuments = async (collectionName: string, constraints: any[] = []) => {
    if (!$db) {
      throw new Error('Firebase Firestore is not initialized. Please check your .env file.')
    }
    
    try {
      const q = constraints.length > 0 
        ? query(collection($db, collectionName), ...constraints)
        : collection($db, collectionName)
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting documents:', error)
      throw error
    }
  }

  const subscribeToCollection = (collectionName: string, constraints: any[] = [], callback: (docs: any[]) => void) => {
    if (!$db) {
      console.error('Firebase Firestore is not initialized. Please check your .env file.')
      return () => {} // Return empty unsubscribe function
    }
    
    const q = constraints.length > 0 
      ? query(collection($db, collectionName), ...constraints)
      : collection($db, collectionName)
    
    return onSnapshot(q, (querySnapshot) => {
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      callback(docs)
    })
  }

  return {
    addDocument,
    updateDocument,
    deleteDocument,
    getDocuments,
    subscribeToCollection
  }
}
