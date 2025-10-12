import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'

export const useAuth = () => {
  const { $auth } = useNuxtApp()
  const user = ref<User | null>(null)
  const loading = ref(true)

  const signInWithGoogle = async () => {
    if (!$auth) {
      throw new Error('Firebase Auth is not initialized. Please check your .env file.')
    }

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup($auth, provider)
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  const logout = async () => {
    if (!$auth) {
      throw new Error('Firebase Auth is not initialized. Please check your .env file.')
    }

    try {
      await signOut($auth)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  onMounted(() => {
    if ($auth) {
      onAuthStateChanged($auth, (firebaseUser) => {
        user.value = firebaseUser
        loading.value = false
      })
    } else {
      loading.value = false
      console.error('Firebase Auth is not initialized. Please check your .env file.')
    }
  })

  return {
    user: readonly(user),
    loading: readonly(loading),
    signInWithGoogle,
    logout
  }
}
