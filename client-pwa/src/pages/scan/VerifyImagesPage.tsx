import { useState } from 'react';
import { useScan } from '../../context/ScanContext';

export function VerifyImagesPage() {
  const { state, dispatch } = useScan();
  const [address, setAddress] = useState(state.address || '');

  const allImages = [...state.images, ...state.pendingRoomImages];

  const handleApprove = () => {
    if (state.pendingRoomImages.length > 0) {
      dispatch({ type: 'COMMIT_PENDING' });
    }
    // Store address in context before processing
    if (address.trim()) {
      dispatch({ type: 'SET_SCAN_INFO', payload: { scanId: '', address: address.trim() } });
    }
    dispatch({ type: 'SET_PHASE', payload: 'processing' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', payload: 'capture' });
  };

  const handleRemoveImage = (imageId: string) => {
    dispatch({ type: 'REMOVE_IMAGE', payload: imageId });
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-700/40 bg-slate-900/70 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Step 1 of 2 · Verify photos
          </span>
          <h2 className="text-xl font-bold text-slate-100">Review captured images</h2>
          <p className="text-sm text-slate-400">
            Confirm everything looks good before we analyze ({allImages.length} total)
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        {/* Address Input */}
        <div className="mx-auto mb-6 max-w-md">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            House Address (optional)
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, City, State"
            className="w-full rounded-lg border border-slate-700/60 bg-slate-800/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {allImages.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/50 text-center">
            <span className="mb-3 text-4xl">📷</span>
            <p className="text-base font-medium text-slate-200">No photos yet</p>
            <p className="text-sm text-slate-500">Go back and add at least one photo</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {allImages.map((image, index) => (
              <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-slate-700/60">
                <img
                  src={image.url}
                  alt={`Room ${image.roomIndex + 1} - Image ${index + 1}`}
                  className="h-36 w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 text-xs text-white/80">
                  Room {image.roomIndex + 1}
                </div>
                <button
                  onClick={() => handleRemoveImage(image.id)}
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-slate-700/40 bg-slate-900/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            onClick={handleBack}
            className="flex-1 rounded-lg border border-slate-700/60 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
          >
            ← Back to capture
          </button>
          <button
            onClick={handleApprove}
            disabled={allImages.length === 0}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve & process
          </button>
        </div>
      </footer>
    </div>
  );
}