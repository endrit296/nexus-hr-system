import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setAccessToken,
  setAuthSession,
  setStoredUser,
} from '../api/authStorage';

const useAuthStore = create(
  persist(
    (set) => ({
      user:         getStoredUser(),
      token:        getAccessToken(),
      refreshToken: getRefreshToken(),

      login: (user, token, refreshToken) => {
        setAuthSession({ user, token, refreshToken });
        set({ user, token, refreshToken });
      },

      logout: () => {
        clearAuthSession();
        set({ user: null, token: null, refreshToken: null });
      },

      setUser: (user) => {
        setStoredUser(user);
        set({ user });
      },

      setToken: (token) => {
        setAccessToken(token);
        set({ token });
      },
    }),
    {
      name:    'nexus_auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
);

export default useAuthStore;
