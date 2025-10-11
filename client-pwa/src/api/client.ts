import axios from 'axios';
import type { AxiosResponse } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  timeout: 60000, // Increased timeout for AI processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      response.data.data !== undefined
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(
            `${apiClient.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );

          const payload =
            response.data &&
            typeof response.data === 'object' &&
            'data' in response.data
              ? response.data.data
              : response.data;

          if (payload?.accessToken) {
            localStorage.setItem('auth_token', payload.accessToken);
            if (payload.refreshToken) {
              localStorage.setItem('refresh_token', payload.refreshToken);
            }

            originalRequest.headers.Authorization = `Bearer ${payload.accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Log errors for debugging
    if (error.response) {
      console.error('API error:', error.response.status, error.response.data);
    } else {
      console.error('API network error:', error.message);
    }

    return Promise.reject(error);
  }
);

// Keep backward compatibility
export const api = apiClient;
