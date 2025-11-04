export interface ScanDetailsResponse {
  id: string;
  status: string;
  houseId: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  detectedHouseTypes: string[];
  house: {
    id: string;
    address: string | null;
    houseType: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  rooms: Array<{
    id: string;
    ordinal: number;
    label: string;
    detectedRoomTypes: string[];
    images: Array<{
      id: string;
      url: string;
      tag: string | null;
      createdAt: string;
    }>;
  }>;
  images: Array<{
    id: string;
    url: string;
    tag: string | null;
    roomId: string;
    createdAt: string;
  }>;
  summary: {
    id: string;
    summaryJson: any;
    prosConsJson: any;
    costSummary: any;
    derivedAt: string;
  } | null;
  agentRuns: Array<{
    id: string;
    agentName: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number | null;
    startedAt: string;
    finishedAt: string;
  }>;
}

export interface HistoryItem {
  id: string;
  address?: string;
  date: string;
  status: string;
  totalRooms: number;
  totalProducts: number;
  thumbnail?: string;
}
