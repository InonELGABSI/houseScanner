import { apiClient } from './client';
import type {
  ChecklistSubmission,
  ProcessScanResponse,
  ScanResponse,
  ScanResults,
} from '../types/scan';

export const scanAPI = {
  // Create a new scan (house is created automatically if not provided)
  createScan: async (data?: {
    houseId?: string;
    address?: string;
  }): Promise<{ scanId: string; houseId: string; status: string }> => {
    const response = await apiClient.post('/scans', data || {});
    return response.data;
  },

  // Upload image files to existing scan
  uploadImagesWithFiles: async (data: {
    scanId: string;
    files: File[];
    address?: string;
    rooms?: Array<{ imageIndices: string[] }>;
  }): Promise<{ scanId: string; roomsCount: number; imagesCount: number; message: string }> => {
    const formData = new FormData();
    if (data.address) {
      formData.append('address', data.address);
    }
    if (data.rooms) {
      formData.append('rooms', JSON.stringify(data.rooms));
    }
    data.files.forEach((file) => {
      formData.append('images', file);
    });

    const response = await apiClient.post(`/scans/${data.scanId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Process uploaded scan
  processScan: async (scanId: string): Promise<ProcessScanResponse> => {
    const response = await apiClient.post(`/scans/${scanId}/process`, {});
    return response.data;
  },

  // Get scan details (includes house, rooms, images, summary)
  getScanDetails: async (scanId: string): Promise<any> => {
    const response = await apiClient.get(`/scans/${scanId}`);
    return response.data;
  },

  // Get scan history for current user
  getScanHistory: async (): Promise<ScanResponse[]> => {
    const response = await apiClient.get('/users/me/scans');
    return response.data;
  },

  // Get scan summary
  getScanSummary: async (scanId: string): Promise<any> => {
    const response = await apiClient.get(`/scans/${scanId}/summary`);
    return response.data;
  },

  // Get scan results with detailed information
  getScanResults: async (scanId: string): Promise<ScanResults> => {
    const response = await apiClient.get(`/scans/${scanId}/results`);
    return response.data;
  },

  // Submit checklist decisions
  submitChecklist: async (data: ChecklistSubmission): Promise<void> => {
    await apiClient.post(`/scans/${data.scanId}/checklist`, data);
  },

  // Delete scan (removes scan, rooms, images, summary from DB and storage)
  deleteScan: async (scanId: string): Promise<{ message: string; scanId: string }> => {
    const response = await apiClient.delete(`/scans/${scanId}`);
    return response.data;
  },
};