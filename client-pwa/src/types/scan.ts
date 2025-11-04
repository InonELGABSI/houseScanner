export interface ScanResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  address?: string;
  createdAt: string;
}

export interface ScanResults {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    products: Record<string, boolean>;
  }>;
  summary?: {
    totalRooms: number;
    totalProducts: number;
    recommendations: string[];
  };
}

export interface ChecklistSubmission {
  scanId: string;
  decisions: Array<{
    roomId: string;
    productName: string;
    shouldStay: boolean;
  }>;
}

export interface UploadImagesPayload {
  houseId: string;
  scanId?: string;
  images: Array<{
    roomId?: string;
    roomLabel?: string;
    url: string;
    tag?: string;
  }>;
  address?: string;
  houseType?: string;
}

export interface UploadImagesResponse {
  scan: {
    id: string;
    status: string;
  };
  rooms: Array<{
    id: string;
    label?: string;
  }>;
  message: string;
}

export interface ProcessScanPayload {
  scanId: string;
}

export interface ProcessScanResponse {
  scanId: string;
  status: string;
  message: string;
}
