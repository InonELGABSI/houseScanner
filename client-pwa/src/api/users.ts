import { apiClient } from './client';
import type { UpdateUserProfile, UserProfile } from '../types/users';

export const usersAPI = {
  // Get current user profile
  getMe: async (): Promise<UserProfile> => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  // Update current user profile
  updateMe: async (data: UpdateUserProfile): Promise<UserProfile> => {
    const response = await apiClient.patch('/users/me', data);
    return response.data;
  },

  // Get current user's scan history
  getMyScanHistory: async (): Promise<any[]> => {
    const response = await apiClient.get('/users/me/scans');
    return response.data;
  },

  // Get current user's checklists
  getMyChecklists: async (): Promise<any[]> => {
    const response = await apiClient.get('/users/me/checklists');
    return response.data;
  },
};
