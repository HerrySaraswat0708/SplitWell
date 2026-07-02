import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

const storedUser = localStorage.getItem('sw_user');
const storedToken = localStorage.getItem('sw_token');

export const useAuthStore = create<AuthState>(set => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,
  setAuth: (user, token) => {
    localStorage.setItem('sw_token', token);
    localStorage.setItem('sw_user', JSON.stringify(user));
    set({ user, token });
  },
  setUser: (user) => {
    localStorage.setItem('sw_user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('sw_token');
    localStorage.removeItem('sw_user');
    set({ user: null, token: null });
  },
}));
