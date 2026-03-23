import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import type { APIResponse, AuthResponse, UserInfo } from '../types';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  loginWithCredentials: (username: string, password: string) => Promise<void>;
  setAuth: (token: string, refreshToken: string, user: UserInfo) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateUser: (user: Partial<UserInfo>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (token: string, refreshToken: string, user: UserInfo) => {
        set({ token, refreshToken, user, isAuthenticated: true });
      },

      loginWithCredentials: async (username: string, password: string) => {
        const { data: resp } = await api.post<APIResponse<AuthResponse>>(
          '/auth/login',
          { username, password },
        );
        const authData = resp.data;
        set({
          token: authData.access_token,
          refreshToken: authData.refresh_token,
          user: authData.user,
          isAuthenticated: true,
        });
      },

      logout: () => {
        // Fire-and-forget the server logout
        const token = get().token;
        if (token) {
          api.post('/auth/logout').catch(() => {});
        }
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async () => {
        const currentRefreshToken = get().refreshToken;
        if (!currentRefreshToken) {
          get().logout();
          return;
        }
        try {
          const { data: resp } = await api.post<APIResponse<AuthResponse>>(
            '/auth/refresh',
            { refresh_token: currentRefreshToken },
          );
          const authData = resp.data;
          set({
            token: authData.access_token,
            refreshToken: authData.refresh_token,
            user: authData.user,
            isAuthenticated: true,
          });
        } catch (err) {
          console.error('[auth] Token refresh failed:', err);
          get().logout();
        }
      },

      fetchCurrentUser: async () => {
        try {
          const { data: resp } = await api.get<APIResponse<UserInfo>>(
            '/auth/me',
          );
          set({ user: resp.data });
        } catch (err) {
          console.error('[auth] fetchCurrentUser failed:', err);
          get().logout();
        }
      },

      updateUser: (updates: Partial<UserInfo>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },
    }),
    {
      name: 'adminchat-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
