import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scanAPI } from './scan';
import { authAPI } from './auth';
import type { ScanResponse, ScanResults, ChecklistSubmission } from './scan';

// Authentication hooks
export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return authAPI.login({ email, password });
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: async ({ 
      email, 
      password, 
      firstName, 
      lastName 
    }: { 
      email: string; 
      password: string; 
      firstName: string; 
      lastName: string; 
    }) => {
      return authAPI.signup({ email, password, firstName, lastName });
    },
  });
}

// Scan hooks
export function useCreateScan() {
  const queryClient = useQueryClient();
  
  return useMutation<ScanResponse, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      return scanAPI.createScan(formData);
    },
    onSuccess: () => {
      // Invalidate scan history to refresh the list
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
      // Stop polling when scan is completed or failed
      if (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds while processing
    },
  });
}

export function useSubmitChecklist() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, ChecklistSubmission>({
    mutationFn: async (data: ChecklistSubmission) => {
      return scanAPI.submitChecklist(data);
    },
    onSuccess: (_, variables) => {
      // Invalidate scan results and summary
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
  return useQuery<any, Error>({
    queryKey: ['scans', scanId, 'summary'],
    queryFn: () => scanAPI.getScanSummary(scanId!),
    enabled: !!scanId,
  });
}

// Utility hook for polling scan status
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
      return 2000; // Poll every 2 seconds
    },
  });
}

// Legacy hooks for compatibility (these can be removed once components are updated)
export function useListHistory() {
  return useScanHistory();
}

export function usePollSummary() {
  // This hook is no longer needed with the new architecture
  return useQuery({
    queryKey: ['legacy-poll'],
    queryFn: () => null,
    enabled: false,
  });
}