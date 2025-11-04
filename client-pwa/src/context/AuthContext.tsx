import { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI } from '../api';
import type { User, AuthState, AuthContextValue } from '../types';
import { scanSocket } from '../services/scanSocket';

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AUTH'; payload: { user: User; token: string } }
  | { type: 'CLEAR_AUTH' }
  | { type: 'SET_USER'; payload: User };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth_token'),
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_AUTH':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'CLEAR_AUTH':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authAPI.login({ email, password });
      
      localStorage.setItem('auth_token', response.accessToken);
      localStorage.setItem('refresh_token', response.refreshToken);
      
      dispatch({
        type: 'SET_AUTH',
        payload: { user: response.user, token: response.accessToken },
      });

      // Connect WebSocket after successful login
      scanSocket.connect(response.user.id);
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authAPI.signup({ email, password, firstName, lastName });
      
      localStorage.setItem('auth_token', response.accessToken);
      localStorage.setItem('refresh_token', response.refreshToken);
      
      dispatch({
        type: 'SET_AUTH',
        payload: { user: response.user, token: response.accessToken },
      });

      // Connect WebSocket after successful signup
      scanSocket.connect(response.user.id);
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    
    // Disconnect WebSocket on logout
    scanSocket.disconnect();
    
    dispatch({ type: 'CLEAR_AUTH' });
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await authAPI.refreshToken({ refreshToken });
      
      localStorage.setItem('auth_token', response.accessToken);
      dispatch({
        type: 'SET_AUTH',
        payload: { user: response.user, token: response.accessToken },
      });
    } catch (error) {
      logout();
      throw error;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const user = await authAPI.getProfile();
        dispatch({ type: 'SET_AUTH', payload: { user, token } });
        
        // Reconnect WebSocket if user was already authenticated
        scanSocket.connect(user.id);
      } catch (error) {
        // Token might be expired, try refreshing
        try {
          await refreshToken();
        } catch (refreshError) {
          logout();
        }
      }
    };

    initAuth();
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    signup,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}