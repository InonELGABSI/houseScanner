import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'manager' | 'admin';
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authAPI = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  signup: async (data: SignupRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  refreshToken: async (data: RefreshTokenRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/refresh', data);
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  logout: (): void => {
    // Clear tokens on client side
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  },
};