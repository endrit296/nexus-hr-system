import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user:         null,
      token:        null,
      refreshToken: null,

      login: (user, token, refreshToken) => {
        localStorage.setItem('token',        token);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, token, refreshToken });
      },

      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('nexus_user');
        set({ user: null, token: null, refreshToken: null });
      },

      setUser:  (user)  => set({ user }),
      setToken: (token) => { localStorage.setItem('token', token); set({ token }); },
    }),
    {
      name:    'nexus_auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
);

export default useAuthStore;
