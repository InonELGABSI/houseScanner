import type { ReactNode } from 'react';
import type { User } from './auth';

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export interface AuthProviderProps {
  children: ReactNode;
}
