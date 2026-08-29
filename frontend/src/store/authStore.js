import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      logout: () => {
        set({ token: null, user: null })
        window.location.href = '/login'
      },

      isLoggedIn: () => !!get().token,
    }),
    {
      name: 'reforge-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
