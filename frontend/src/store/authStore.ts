import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  name: string
  role: string
  permissions: string[]
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  
  // Actions
  setSession: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setSession: (user, token) => set({
        user,
        token,
        isAuthenticated: true
      }),

      logout: () => {
        // Here we could also call authService.logout() if needed,
        // but typically the logout clears local state. 
        // The AppInitializer or a logout button will call the API.
        set({
          user: null,
          token: null,
          isAuthenticated: false
        })
      }
    }),
    {
      name: 'auth-storage',
      // Only persist token and basic user info, we can re-fetch permissions on startup
    }
  )
)
