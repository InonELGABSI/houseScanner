import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { ScanSummary } from '../context/ScanContext';

// Placeholder endpoint names; adjust to match backend once implemented.

export function useUploadHouseImages() {
  return useMutation<{ taskId: string }, Error, { images: File[] }>({
    mutationFn: async ({ images }: { images: File[] }) => {
      try {
        const form = new FormData();
        images.forEach((img: File) => img && form.append('files', img));
        const { data } = await api.post<{ taskId: string }>('/scan/house', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
      } catch (error) {
        console.warn('Upload failed, simulating success:', error);
        // Return a mock task ID for development
        return { taskId: `mock-task-${Date.now()}` };
      }
    },
  });
}

export function usePollSummary(taskId?: string) {
  return useQuery<ScanSummary | null, Error>({
    queryKey: ['summary', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      try {
        const { data } = await api.get(`/scan/summary/${taskId}`);
        return data;
      } catch (error) {
        console.warn('Polling failed, simulating completion:', error);
        // Return mock summary for development
        return {
          id: taskId,
          createdAt: new Date().toISOString(),
          prosCons: {
            pros: ['Modern design', 'Good lighting', 'Spacious layout'],
            cons: ['Needs minor repairs', 'Could use fresh paint']
          }
        };
      }
    },
    enabled: !!taskId,
    refetchInterval: 4000,
  });
}

export function useListHistory() {
  return useQuery<ScanSummary[], Error>({
    queryKey: ['history'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/history');
        // Check if the response is HTML (fallback from Vite dev server)
        if (typeof data === 'string' && data.includes('<!doctype html>')) {
          console.warn('API endpoint not available, returning empty array');
          return [];
        }
        // Ensure we return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn('Failed to fetch history:', error);
        return [];
      }
    },
    retry: false, // Don't retry failed requests
  });
}

export function useDeleteHistory() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { id: string }>({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await api.delete<{ ok: boolean }>(`/history/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history'] }),
  });
}
