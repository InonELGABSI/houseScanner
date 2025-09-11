import { useEffect } from 'react';
import { useCaptureRoom } from '../hooks/useCaptureRoom';
import { useUploadHouseImages, usePollSummary } from '../api/hooks';
import { useScan } from '../context/ScanContext';

export function ScanRoot() {
  const { phase, roomIndex } = useCaptureRoom();
  return (
    <div className="p-4 space-y-6">
      {phase === 'idle' && <StartScan />}
      {phase === 'capturing' && <CaptureRoom />}
      {phase === 'uploading' && <Uploading />}
      {phase === 'awaitingSummary' && <AwaitSummary />}
      {phase === 'complete' && <ScanComplete />}
      <div className="text-xs text-slate-500 text-center">Phase: {phase} • Room: {roomIndex}</div>
    </div>
  );
}

function StartScan() {
  const { dispatch } = useScan();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] pt-8">
      {/* Hero Icon */}
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg animate-pulse flex items-center justify-center">
          <span className="text-4xl">🏠</span>
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
          <span className="text-sm">📷</span>
        </div>
      </div>

      {/* Title and Description */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
          Start House Scan
        </h1>
        <p className="text-slate-400 text-lg max-w-md">
          Capture photos of each room to get an AI-powered analysis of your house
        </p>
      </div>

      {/* Start Button */}
      <button 
        className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95" 
        onClick={() => dispatch({ type: 'START_SCAN' })}
      >
        <span className="flex items-center gap-2">
          <span>🚀</span>
          Start Scanning
        </span>
      </button>
    </div>
  );
}

function CaptureRoom() {
  const { capture, nextRoom, doneHouseCapture, pendingRoomImages, roomIndex, cancel } = useCaptureRoom();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach(f => capture(f));
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Room Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
          Room {roomIndex + 1}
        </h2>
        <p className="text-slate-400">Capture photos of this room from different angles</p>
      </div>

      {/* File Input */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <label className="block">
          <span className="sr-only">Choose photos</span>
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            capture="environment" 
            onChange={onFile} 
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-500 cursor-pointer" 
          />
        </label>
        <p className="text-xs text-slate-500 mt-2">Tap to select multiple photos</p>
      </div>

      {/* Image Grid */}
      {pendingRoomImages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200">Captured Photos ({pendingRoomImages.length})</h3>
          <div className="grid grid-cols-2 gap-3">
            {pendingRoomImages.map(img => (
              <div key={img.id} className="relative group">
                <img 
                  src={img.url} 
                  className="h-32 w-full object-cover rounded-lg shadow-lg group-hover:shadow-xl transition-shadow duration-200" 
                  alt="Room capture"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors duration-200 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition-opacity duration-200">
                    ✓ Captured
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button 
          className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200" 
          onClick={cancel}
        >
          Cancel
        </button>
        <button 
          className="flex-1 bg-slate-600 hover:bg-slate-500 active:bg-slate-700 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200" 
          onClick={nextRoom}
        >
          Next Room
        </button>
        <button 
          className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 active:from-primary-700 active:to-primary-800 px-4 py-3 rounded-lg text-sm font-medium shadow-lg hover:shadow-glow transition-all duration-200" 
          onClick={doneHouseCapture}
        >
          Complete Scan
        </button>
      </div>
    </div>
  );
}

function Uploading() {
  const { state, dispatch } = useScan();
  const upload = useUploadHouseImages();

  useEffect(() => {
    const images = state.images.map(i => i.file).filter(Boolean) as File[];
    upload.mutate({ images }, {
      onSuccess: data => {
        dispatch({ type: 'SET_PHASE', payload: 'awaitingSummary' });
        // store task id in a place if needed
        (window as any).__taskId = data.taskId;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-slide-up">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow-lg animate-pulse-slow flex items-center justify-center">
        <span className="text-2xl">📤</span>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-primary-400">Uploading Images</h2>
        <p className="text-slate-400">Uploading {state.images.length} images to our servers...</p>
      </div>
      <div className="w-64 bg-slate-700 rounded-full h-2">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}

function AwaitSummary() {
  const taskId = (window as any).__taskId as string | undefined;
  const summaryQ = usePollSummary(taskId);
  const { dispatch } = useScan();

  useEffect(() => {
    if (summaryQ.data) {
      dispatch({ type: 'ADD_SUMMARY', payload: summaryQ.data });
    }
  }, [summaryQ.data, dispatch]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-slide-up">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow-lg animate-pulse-slow flex items-center justify-center">
        <span className="text-2xl">🤖</span>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-primary-400">AI Analysis in Progress</h2>
        <p className="text-slate-400">Our AI is analyzing your house photos...</p>
      </div>
      <div className="flex space-x-2">
        <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
        <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
      </div>
    </div>
  );
}

function ScanComplete() {
  const { state } = useScan();
  const summary = state.summaries[0];
  if (!summary) return <div>No summary.</div>;
  
  return (
    <div className="space-y-6 animate-slide-up">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow-lg flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
          Scan Complete!
        </h2>
        <p className="text-slate-400">Here's your AI-powered house analysis</p>
      </div>

      {/* Summary Card */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 space-y-4">
        <div className="text-sm text-slate-400 border-b border-slate-700/50 pb-2">
          Completed: {summary.createdAt}
        </div>
        
        {summary.prosCons && (
          <div className="space-y-4">
            {/* Pros */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h3 className="text-lg font-semibold text-primary-400">Strengths</h3>
              </div>
              <ul className="space-y-2 ml-6">
                {summary.prosCons.pros.map((p, index) => (
                  <li key={index} className="flex items-start gap-2 text-slate-300">
                    <span className="text-primary-500 mt-1">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <h3 className="text-lg font-semibold text-accent-400">Areas for Improvement</h3>
              </div>
              <ul className="space-y-2 ml-6">
                {summary.prosCons.cons.map((c, index) => (
                  <li key={index} className="flex items-start gap-2 text-slate-300">
                    <span className="text-accent-500 mt-1">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button 
        className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 active:from-primary-700 active:to-primary-800 px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-glow transition-all duration-200"
        onClick={() => window.location.reload()}
      >
        Start New Scan
      </button>
    </div>
  );
}
