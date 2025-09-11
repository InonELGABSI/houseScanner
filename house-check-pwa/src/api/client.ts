import axios from 'axios';
import type { AxiosResponse } from 'axios';

export const api = axios.create({
  baseURL: '/api', // configure proxy in vite.config if needed
  timeout: 30000,
});

api.interceptors.response.use((r: AxiosResponse) => r, (err: any) => {
  // basic normalization
  if (err.response) {
    console.error('API error', err.response.status, err.response.data);
  } else {
    console.error('API network error', err.message);
  }
  return Promise.reject(err);
});
