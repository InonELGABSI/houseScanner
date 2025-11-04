import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api';
import type { AuthResponse, LoginRequest, SignupRequest } from '../types/auth';

export function useLogin() {
  return useMutation<AuthResponse, Error, LoginRequest>({
    mutationFn: (credentials) => authAPI.login(credentials),
  });
}

export function useSignup() {
  return useMutation<AuthResponse, Error, SignupRequest>({
    mutationFn: (payload) => authAPI.signup(payload),
  });
}
