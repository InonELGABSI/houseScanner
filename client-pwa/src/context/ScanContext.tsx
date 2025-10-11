import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';

// Core domain types (can refine later when server schemas are available)
export type ImageRef = { id: string; roomIndex: number; file: File | null; url: string };
export type HouseType = string; // server may return multiple types
export type RoomType = string;  // multiple possible
export type ProductType = string;

export interface ChecklistAnswer {
  id: string;              // unique key (house/room/product/custom:<id>)
  scope: 'house' | 'room' | 'product' | 'custom';
  targetId?: string;       // room index or product identifier
  field: string;           // checklist field key
  value: boolean | string; // booleans for yes/no; string for categorical
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
  rawData?: any; // Store the complete server response for detailed views
}

type ScanPhase =
  | 'idle'          // Start scan screen with house animation
  | 'capture'       // Add room images (upload or camera)
  | 'verify'        // Verify images before processing
  | 'processing'    // Loading/processing images
  | 'summary';      // Scan summary step

type CaptureMode = 'upload' | 'camera';

// Helper function to generate generic room names
const getRoomName = (index: number) => `Room ${index + 1}`;

interface State {
  phase: ScanPhase;
  captureMode: CaptureMode;
  currentRoomIndex: number;
  currentRoomName: string;
  totalRooms: number;
  images: ImageRef[];
  pendingRoomImages: ImageRef[]; // images captured for current room before commit
  summaries: ScanSummary[];      // local history
  activeSummaryId?: string;      // currently viewed summary
  productDecisions: ProductDecision[]; // track user decisions on products
  scanId?: string;               // current scan ID from server
  address?: string;              // house address
}

const initialState: State = {
  phase: 'idle',
  captureMode: 'upload',
  currentRoomIndex: 0,
  currentRoomName: 'Room 1',
  totalRooms: 5,
  images: [],
  pendingRoomImages: [],
  summaries: [],
  productDecisions: [],
};

type Action =
  | { type: 'START_SCAN' }
  | { type: 'CAPTURE_IMAGE'; payload: ImageRef }
  | { type: 'REMOVE_IMAGE'; payload: string } // image id
  | { type: 'NEXT_ROOM' }
  | { type: 'PREV_ROOM' }
  | { type: 'COMMIT_PENDING' }
  | { type: 'CANCEL_SCAN' }
  | { type: 'SET_PHASE'; payload: ScanPhase }
  | { type: 'SET_ROOM_INFO'; payload: { roomIndex: number; roomName: string; totalRooms: number } }
  | { type: 'SET_SCAN_INFO'; payload: { scanId: string; address?: string } }
  | { type: 'SET_CAPTURE_MODE'; payload: CaptureMode }
  | { type: 'ADD_SUMMARY'; payload: ScanSummary }
  | { type: 'SET_ACTIVE_SUMMARY'; payload?: string }
  | { type: 'UPDATE_PRODUCT_DECISION'; payload: ProductDecision };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_SCAN':
      return { 
        ...state, 
        phase: 'capture', 
        captureMode: 'upload',
        currentRoomIndex: 0, 
        currentRoomName: getRoomName(0),
        images: [], 
        pendingRoomImages: [] 
      };
    case 'CAPTURE_IMAGE':
      return { ...state, pendingRoomImages: [...state.pendingRoomImages, action.payload] };
    case 'REMOVE_IMAGE':
      return { 
        ...state, 
        pendingRoomImages: state.pendingRoomImages.filter(img => img.id !== action.payload),
        images: state.images.filter(img => img.id !== action.payload)
      };
    case 'NEXT_ROOM':
      const committedImages = state.pendingRoomImages.length
        ? [...state.images, ...state.pendingRoomImages]
        : state.images;
      const nextIndex = Math.min(state.currentRoomIndex + 1, state.totalRooms - 1);
      return { 
        ...state, 
        currentRoomIndex: nextIndex,
        currentRoomName: getRoomName(nextIndex),
        images: committedImages,
        pendingRoomImages: [],
        captureMode: 'upload'
      };
    case 'PREV_ROOM':
      const prevIndex = Math.max(state.currentRoomIndex - 1, 0);
      return { 
        ...state, 
        currentRoomIndex: prevIndex,
        currentRoomName: getRoomName(prevIndex),
        pendingRoomImages: [],
        captureMode: 'upload'
      };
    case 'COMMIT_PENDING':
      if (state.pendingRoomImages.length === 0) {
        return state;
      }
      return {
        ...state,
        images: [...state.images, ...state.pendingRoomImages],
        pendingRoomImages: [],
      };
    case 'CANCEL_SCAN':
      return { ...initialState };
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    case 'SET_ROOM_INFO':
      return { 
        ...state, 
        currentRoomIndex: action.payload.roomIndex,
        currentRoomName: action.payload.roomName,
        totalRooms: action.payload.totalRooms
      };
    case 'SET_SCAN_INFO':
      return { 
        ...state, 
        scanId: action.payload.scanId,
        address: action.payload.address
      };
    case 'SET_CAPTURE_MODE':
      return { ...state, captureMode: action.payload };
    case 'ADD_SUMMARY':
      return { 
        ...state, 
        summaries: [action.payload, ...state.summaries], 
        activeSummaryId: action.payload.id, 
        phase: 'summary' 
      };
    case 'SET_ACTIVE_SUMMARY':
      return { ...state, activeSummaryId: action.payload };
    case 'UPDATE_PRODUCT_DECISION':
      const existingIndex = state.productDecisions.findIndex(
        d => d.roomId === action.payload.roomId && d.productName === action.payload.productName
      );
      const newDecisions = [...state.productDecisions];
      if (existingIndex >= 0) {
        newDecisions[existingIndex] = action.payload;
      } else {
        newDecisions.push(action.payload);
      }
      return { ...state, productDecisions: newDecisions };
    default:
      return state;
  }
}

const ScanContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => undefined });

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <ScanContext.Provider value={{ state, dispatch }}>{children}</ScanContext.Provider>;
}

export function useScan() {
  return useContext(ScanContext);
}
