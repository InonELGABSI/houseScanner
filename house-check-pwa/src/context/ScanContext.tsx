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

export interface ScanSummary {
  id: string;
  createdAt: string;
  houseTypes: HouseType[];
  rooms: { index: number; types: RoomType[] }[];
  products: { roomIndex: number; type: ProductType; fields: Record<string, any> }[];
  answers: ChecklistAnswer[];
  prosCons?: { pros: string[]; cons: string[] };
}

interface State {
  phase: 'idle' | 'capturing' | 'room' | 'uploading' | 'awaitingSummary' | 'reviewChecklist' | 'complete';
  currentRoomIndex: number;
  images: ImageRef[];
  pendingRoomImages: ImageRef[]; // images captured for current room before commit
  summaries: ScanSummary[];      // local history
  activeSummaryId?: string;      // currently viewed summary
}

const initialState: State = {
  phase: 'idle',
  currentRoomIndex: 0,
  images: [],
  pendingRoomImages: [],
  summaries: [],
};

type Action =
  | { type: 'START_SCAN' }
  | { type: 'CAPTURE_IMAGE'; payload: ImageRef }
  | { type: 'NEXT_ROOM' }
  | { type: 'CANCEL_SCAN' }
  | { type: 'COMMIT_ROOM' }
  | { type: 'SET_PHASE'; payload: State['phase'] }
  | { type: 'ADD_SUMMARY'; payload: ScanSummary }
  | { type: 'SET_ACTIVE_SUMMARY'; payload?: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_SCAN':
      return { ...state, phase: 'capturing', currentRoomIndex: 0, images: [], pendingRoomImages: [] };
    case 'CAPTURE_IMAGE':
      return { ...state, pendingRoomImages: [...state.pendingRoomImages, action.payload] };
    case 'NEXT_ROOM':
      return { ...state, currentRoomIndex: state.currentRoomIndex + 1, pendingRoomImages: [] };
    case 'CANCEL_SCAN':
      return { ...initialState };
    case 'COMMIT_ROOM':
      return { ...state, images: [...state.images, ...state.pendingRoomImages], pendingRoomImages: [] };
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    case 'ADD_SUMMARY':
      return { ...state, summaries: [action.payload, ...state.summaries], activeSummaryId: action.payload.id, phase: 'complete' };
    case 'SET_ACTIVE_SUMMARY':
      return { ...state, activeSummaryId: action.payload };
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
