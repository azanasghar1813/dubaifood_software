import { create } from 'zustand'

export const CASHIERS = [
  "Ahmed",
  "Ali",
  "Bilal",
  "Hassan",
  "Umar"
]

interface AuthState {
  user: { name: string; role: string } | null
  isAuthenticated: boolean
  login: (name: string, pin: string) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (name: string, pin: string) => {
    // Dummy PIN check: just require a 4-digit PIN for demo purposes
    if (pin.length >= 4 && CASHIERS.includes(name)) {
      set({
        user: { name, role: "Cashier" },
        isAuthenticated: true,
      })
      return true
    }
    return false
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}))
