// API Client
export { apiClient, api } from './client';

// Auth API
export { authAPI } from './auth';
export type { User, LoginRequest, SignupRequest, AuthResponse } from './auth';

// Users API
export { usersAPI } from './users';
export type { UserProfile, UpdateUserProfile } from './users';

// Scans API
export { scanAPI } from './scan';
export type {
  ScanResponse,
  ScanResults,
  ChecklistSubmission,
  UploadImagesPayload,
  UploadImagesResponse,
  ProcessScanPayload,
  ProcessScanResponse,
} from './scan';

// Checklists API
export { checklistsAPI } from './checklists';
export type { Checklist, UpdateChecklistData } from './checklists';

// Hooks
export * from './hooks';
