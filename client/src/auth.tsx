import { createContext, useContext } from 'react';
import type { User } from './types';

export const AuthContext = createContext<{
  user: User | null;
  isAdmin: boolean;
}>({ user: null, isAdmin: false });

export function useAuth() {
  return useContext(AuthContext);
}
