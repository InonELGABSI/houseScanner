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
