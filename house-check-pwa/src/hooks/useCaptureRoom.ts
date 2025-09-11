import { useCallback } from 'react';
import { useScan } from '../context/ScanContext';

// Simple unique id helper (can swap for nanoid later)
function uid() { return Math.random().toString(36).slice(2, 11); }

export function useCaptureRoom() {
  const { state, dispatch } = useScan();

  const capture = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    dispatch({
      type: 'CAPTURE_IMAGE',
      payload: { id: uid(), roomIndex: state.currentRoomIndex, file, url }
    });
  }, [dispatch, state.currentRoomIndex]);

  const nextRoom = useCallback(() => {
    dispatch({ type: 'COMMIT_ROOM' });
    dispatch({ type: 'NEXT_ROOM' });
  }, [dispatch]);

  const doneHouseCapture = useCallback(() => {
    dispatch({ type: 'COMMIT_ROOM' });
    dispatch({ type: 'SET_PHASE', payload: 'uploading' });
  }, [dispatch]);

  const cancel = useCallback(() => {
    dispatch({ type: 'CANCEL_SCAN' });
  }, [dispatch]);

  return {
    phase: state.phase,
    roomIndex: state.currentRoomIndex,
    pendingRoomImages: state.pendingRoomImages,
    capture,
    nextRoom,
    doneHouseCapture,
    cancel,
  };
}
