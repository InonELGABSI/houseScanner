import { apiClient } from './client';

export interface Checklist {
  id: string;
  scope: 'house' | 'room' | 'product';
  name: string;
  version: number;
  itemsRaw: Record<string, unknown>;
  createdAt: string;
  isBase?: boolean;
}

export interface UpdateChecklistData {
  name?: string;
  version?: number;
  itemsRaw?: Record<string, unknown>;
}

export const checklistsAPI = {
  // Get base checklist for a scope
  getBaseChecklist: async (
    scope: 'house' | 'room' | 'product'
  ): Promise<Checklist | null> => {
    const response = await apiClient.get(`/checklists/base/${scope}`);
    return response.data;
  },

  // Update base checklist (admin only)
  updateBaseChecklist: async (
    scope: 'house' | 'room' | 'product',
    data: UpdateChecklistData
  ): Promise<Checklist> => {
    const response = await apiClient.put(`/checklists/base/${scope}`, data);
    return response.data;
  },

  // Update a specific user checklist
  updateChecklist: async (
    checklistId: string,
    data: UpdateChecklistData
  ): Promise<Checklist> => {
    const response = await apiClient.patch(`/checklists/${checklistId}`, data);
    return response.data;
  },

  // Create or update checklist by scope
  upsertByScope: async (
    scope: 'house' | 'room' | 'product',
    data: UpdateChecklistData
  ): Promise<Checklist> => {
    const response = await apiClient.put(`/checklists/scope/${scope}`, data);
    return response.data;
  },
};
