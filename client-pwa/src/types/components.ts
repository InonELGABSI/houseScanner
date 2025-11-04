import type { ReactNode } from 'react';

export interface ProtectedRouteProps {
  children: ReactNode;
}

export interface CameraPanelProps {
  onCapture: (file: File, url: string) => void;
  onCameraError?: () => void;
}

export interface UploadPanelProps {
  onFilesSelected: (files: FileList) => void;
}
