// Core domain types
export type ImageRef = { 
  id: string; 
  roomIndex: number; 
  file: File | null; 
  url: string;
};

export type HouseType = string;
export type RoomType = string;
export type ProductType = string;

export interface ChecklistAnswer {
  id: string;
  scope: 'house' | 'room' | 'product' | 'custom';
  targetId?: string;
  field: string;
  value: boolean | string;
}

export interface ProductDecision {
  roomId: string;
  productName: string;
  shouldStay: boolean;
}

export interface ScanSummary {
  id: string;
  createdAt: string;
  houseTypes: HouseType[];
  rooms: { index: number; types: RoomType[] }[];
  products: { roomIndex: number; type: ProductType; fields: Record<string, any> }[];
  answers: ChecklistAnswer[];
  prosCons?: { pros: string[]; cons: string[] };
  rawData?: any;
}

export type ScanPhase =
  | 'idle'
  | 'capture'
  | 'verify'
  | 'processing'
  | 'summary';

export type CaptureMode = 'upload' | 'camera';

export interface ScanState {
  phase: ScanPhase;
  captureMode: CaptureMode;
  currentRoomIndex: number;
  currentRoomName: string;
  totalRooms: number;
  images: ImageRef[];
  pendingRoomImages: ImageRef[];
  summaries: ScanSummary[];
  activeSummaryId?: string;
  productDecisions: ProductDecision[];
  scanId?: string;
  address?: string;
}
