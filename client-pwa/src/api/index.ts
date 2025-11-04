// API Client
export { apiClient, api } from './client';

// Auth API
export { authAPI } from './auth';
export type {
  AuthResponse,
  LoginRequest,
  RefreshTokenRequest,
  SignupRequest,
  User,
} from '../types/auth';

// Users API
export { usersAPI } from './users';
export type { UpdateUserProfile, UserProfile } from '../types/users';

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
} from '../types/scan';

// Checklists API
export { checklistsAPI } from './checklists';
export type { Checklist, UpdateChecklistData } from '../types/checklists';
