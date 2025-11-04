import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scanAPI } from '../api';
import type { ChecklistSubmission, ScanResponse, ScanResults } from '../types/scan';

export function useCreateScan() {
  const queryClient = useQueryClient();

  return useMutation<{ scanId: string; houseId: string; status: string }, Error, { houseId?: string; address?: string }>({
    mutationFn: (payload) => scanAPI.createScan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

export function useScanResults(scanId: string | undefined) {
  return useQuery<ScanResults, Error>({
    queryKey: ['scans', scanId, 'results'],
    queryFn: () => scanAPI.getScanResults(scanId!),
    enabled: !!scanId,
    refetchInterval: (query) => {
      if (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') {
        return false;
      }
      return 3000;
    },
  });
}

export function useSubmitChecklist() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ChecklistSubmission>({
    mutationFn: (submission) => scanAPI.submitChecklist(submission),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scans', variables.scanId] });
    },
  });
}

export function useScanHistory() {
  return useQuery<ScanResponse[], Error>({
    queryKey: ['scans'],
    queryFn: () => scanAPI.getScanHistory(),
  });
}

export function useScanSummary(scanId: string | undefined) {
  return useQuery<unknown, Error>({
    queryKey: ['scans', scanId, 'summary'],
    queryFn: () => scanAPI.getScanSummary(scanId!),
    enabled: !!scanId,
  });
}

export function usePollScanStatus(scanId: string | undefined) {
  return useQuery<ScanResponse, Error>({
    queryKey: ['scans', scanId, 'status'],
    queryFn: async () => {
      const results = await scanAPI.getScanResults(scanId!);
      return {
        id: results.id,
        status: results.status,
        createdAt: new Date().toISOString(),
      };
    },
    enabled: !!scanId,
    refetchInterval: (query) => {
      if (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') {
        return false;
      }
      return 2000;
    },
  });
}

export function usePollSummary(scanId: string | undefined) {
  return useQuery({
    queryKey: ['legacy-poll', scanId],
    queryFn: () => null,
    enabled: false,
  });
}

export function useListHistory() {
  return useScanHistory();
}
