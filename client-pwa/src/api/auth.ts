import { apiClient } from './client';
import type {
  AuthResponse,
  LoginRequest,
  RefreshTokenRequest,
  SignupRequest,
  User,
} from '../types/auth';

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