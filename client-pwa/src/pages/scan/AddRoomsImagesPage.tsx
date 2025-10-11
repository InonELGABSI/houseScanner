import { useMemo } from 'react';
import { useScan } from '../../context/ScanContext';
import { UploadPanel } from './components/UploadPanel';
import { CameraPanel } from './components/CameraPanel';

export function AddRoomsImagesPage() {
  const { state, dispatch } = useScan();
  const {
    captureMode,
    currentRoomIndex,
    currentRoomName,
    totalRooms,
    images,
    pendingRoomImages,
  } = state;

  const currentRoomImages = useMemo(() => {
    return [...images, ...pendingRoomImages].filter(
      image => image.roomIndex === currentRoomIndex
    );
  }, [images, pendingRoomImages, currentRoomIndex]);

  const totalCaptured = images.length + pendingRoomImages.length;

  const handleFilesSelected = (files: FileList) => {
    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) {
        return;
      }

      const url = URL.createObjectURL(file);
      dispatch({
        type: 'CAPTURE_IMAGE',
        payload: {
          id: `${Date.now()}-${currentRoomIndex}-${index}`,
          roomIndex: currentRoomIndex,
          file,
          url,
        },
      });
    });
  };

  const handleCameraCapture = (file: File, url: string) => {
    dispatch({
      type: 'CAPTURE_IMAGE',
      payload: {
        id: `${Date.now()}-${currentRoomIndex}-camera`,
        roomIndex: currentRoomIndex,
        file,
        url,
      },
    });
  };

  const handleRemoveImage = (imageId: string) => {
    const image = [...images, ...pendingRoomImages].find(item => item.id === imageId);
    if (image) {
      URL.revokeObjectURL(image.url);
    }
    dispatch({ type: 'REMOVE_IMAGE', payload: imageId });
  };

  const handleNextRoom = () => {
    if (currentRoomIndex >= totalRooms - 1) return;
    dispatch({ type: 'NEXT_ROOM' });
  };

  const handlePrev = () => {
    if (pendingRoomImages.length > 0) {
      dispatch({ type: 'COMMIT_PENDING' });
    }

    if (currentRoomIndex === 0) {
      dispatch({ type: 'SET_PHASE', payload: 'idle' });
      return;
    }

    dispatch({ type: 'PREV_ROOM' });
  };

  const handleDone = () => {
    if (totalCaptured === 0) return;
    dispatch({ type: 'COMMIT_PENDING' });
    dispatch({ type: 'SET_PHASE', payload: 'verify' });
  };

  const handleCancel = () => {
    dispatch({ type: 'CANCEL_SCAN' });
  };

  const hasImagesForRoom = currentRoomImages.length > 0;
  const isLastRoom = currentRoomIndex === totalRooms - 1;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-700/40 bg-slate-900/70 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={handleCancel}
            className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            Cancel
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Room</p>
            <p className="text-lg font-semibold text-slate-100">
              {currentRoomName}
            </p>
            <p className="text-xs text-slate-500">
              {currentRoomIndex + 1} of {totalRooms}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total photos</p>
            <p className="text-lg font-semibold text-emerald-400">{totalCaptured}</p>
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-4">
          {(['upload', 'camera'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => dispatch({ type: 'SET_CAPTURE_MODE', payload: mode })}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                captureMode === mode
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {mode === 'upload' ? 'Upload from device' : 'Use camera'}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        <div className="h-72 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          {captureMode === 'upload' ? (
            <UploadPanel onFilesSelected={handleFilesSelected} />
          ) : (
            <CameraPanel
              onCapture={handleCameraCapture}
              onCameraError={() => dispatch({ type: 'SET_CAPTURE_MODE', payload: 'upload' })}
            />
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">
              Captured for {currentRoomName}
            </h3>
            <span className="text-xs text-slate-500">
              {currentRoomImages.length} photo{currentRoomImages.length === 1 ? '' : 's'}
            </span>
          </div>
          {currentRoomImages.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 text-sm text-slate-500">
              No photos yet. Add at least one to continue.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {currentRoomImages.map(image => (
                <div key={image.id} className="group relative h-28 w-28 flex-shrink-0">
                  <img
                    src={image.url}
                    alt={`Room ${image.roomIndex + 1}`}
                    className="h-full w-full rounded-xl object-cover"
                  />
                  <button
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-slate-700/40 bg-slate-900/80 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handlePrev}
            className="flex-1 rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentRoomIndex === 0 && totalCaptured === 0}
          >
            ← Back
          </button>

          {!isLastRoom && (
            <button
              onClick={handleNextRoom}
              disabled={!hasImagesForRoom}
              className="flex-1 rounded-lg bg-slate-700/80 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next Room →
            </button>
          )}

          <button
            onClick={handleDone}
            disabled={totalCaptured === 0}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLastRoom ? 'Finish & Review' : 'Done for Now'}
          </button>
        </div>
      </footer>
    </div>
  );
}
