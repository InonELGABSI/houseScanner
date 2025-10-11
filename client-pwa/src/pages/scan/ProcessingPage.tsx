import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScan } from '../../context/ScanContext';
import { scanAPI } from '../../api/scan';
import { scanSocket } from '../../services/scanSocket';

export function ProcessingPage() {
  const { state, dispatch } = useScan();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'uploading' | 'uploaded' | 'processing' | 'completed' | 'failed'>('uploading');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Preparing upload...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uploadAndProcess = async () => {
      try {
        const allImages = [...state.images, ...state.pendingRoomImages];
        
        if (allImages.length === 0) {
          setError('No images to process');
          return;
        }

        // Get files to upload
        const filesToUpload = allImages
          .filter(img => img.file !== null)
          .map(img => img.file as File);
        
        if (filesToUpload.length === 0) {
          setError('No image files to upload');
          setStatus('failed');
          return;
        }

        // Step 1: Create scan if not exists
        let currentScanId = state.scanId;
        if (!currentScanId) {
          setStage('Creating scan record...');
          const scanResponse = await scanAPI.createScan({
            address: state.address, // Address is optional, house will be created automatically
          });
          currentScanId = scanResponse.scanId;
          
          // Store the scan info in context
          dispatch({ 
            type: 'SET_SCAN_INFO', 
            payload: { 
              scanId: scanResponse.scanId,
              address: state.address
            } 
          });
        }

        // Step 2: Upload files with scanId
        setStage('Uploading images...');
        const uploadResponse = await scanAPI.uploadImagesWithFiles({
          scanId: currentScanId,
          files: filesToUpload,
          address: state.address || undefined,
        });

        dispatch({ 
          type: 'SET_SCAN_INFO', 
          payload: { 
            scanId: uploadResponse.scanId,
            address: state.address
          } 
        });

        setStage('Waiting for confirmation...');
        // WebSocket will handle the rest via events
        // The 'scan:uploaded' event will trigger processScan automatically

      } catch (err: any) {
        console.error('Error uploading images:', err);
        setError(err.message || 'Failed to upload images');
        setStatus('failed');
      }
    };

    uploadAndProcess();

    // Set up WebSocket listeners
    const handleUploaded = (data: { scanId: string; roomsCount: number; imagesCount: number; message: string }) => {
      console.log('Images uploaded:', data);
      setStatus('uploaded');
      setStage(`${data.imagesCount} images uploaded successfully`);
      
      // Store scanId for manual processing trigger
      dispatch({ 
        type: 'SET_SCAN_INFO', 
        payload: { 
          scanId: data.scanId,
          address: state.address
        } 
      });
    };

    const handleProcessing = (data: { scanId: string; message: string }) => {
      console.log('Processing started:', data);
      setStatus('processing');
      setStage('Processing images...');
      setProgress(20);
    };

    const handleProgress = (data: { scanId: string; progress: number; stage?: string }) => {
      console.log('Progress update:', data);
      setProgress(data.progress);
      if (data.stage) {
        setStage(data.stage);
      }
    };

    const handleCompleted = (data: { scanId: string; message: string; result?: any }) => {
      console.log('Scan completed:', data);
      setStatus('completed');
      setProgress(100);
      setStage('Scan completed!');

      // Navigate to summary after a short delay
      setTimeout(() => {
        if (data.result) {
          // TODO: Transform result to ScanSummary and store in context
          // For now, just navigate to summary phase
          dispatch({ type: 'SET_PHASE', payload: 'summary' });
        } else {
          // Fallback: navigate to summary page
          navigate(`/scan/summary/${data.scanId}`);
        }
      }, 1500);
    };

    const handleFailed = (data: { scanId: string; error: string }) => {
      console.error('Scan failed:', data);
      setStatus('failed');
      setError(data.error);
      setStage('Processing failed');
    };

    // Subscribe to WebSocket events
    scanSocket.on('scan:uploaded', handleUploaded);
    scanSocket.on('scan:processing', handleProcessing);
    scanSocket.on('scan:progress', handleProgress);
    scanSocket.on('scan:completed', handleCompleted);
    scanSocket.on('scan:failed', handleFailed);

    // Cleanup
    return () => {
      scanSocket.off('scan:uploaded', handleUploaded);
      scanSocket.off('scan:processing', handleProcessing);
      scanSocket.off('scan:progress', handleProgress);
      scanSocket.off('scan:completed', handleCompleted);
      scanSocket.off('scan:failed', handleFailed);
    };
  }, []);

  // Handle manual process trigger
  const handleStartProcessing = async () => {
    if (!state.scanId) {
      setError('No scan ID available');
      return;
    }

    try {
      setStatus('processing');
      setStage('Starting processing...');
      await scanAPI.processScan(state.scanId);
    } catch (err: any) {
      console.error('Error starting processing:', err);
      setError(err.message || 'Failed to start processing');
      setStatus('failed');
    }
  };

  if (status === 'failed') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-4">
        <div className="text-4xl mb-4">❌</div>
        <h2 className="text-xl font-bold text-red-400 mb-2">Processing Failed</h2>
        <p className="text-slate-400 text-center mb-6">{error || 'An error occurred'}</p>
        <button
          onClick={() => dispatch({ type: 'SET_PHASE', payload: 'verify' })}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
        >
          ← Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative mb-8 h-24 w-24">
          <div className="h-full w-full rounded-full border-4 border-emerald-500/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
        </div>

        <h2 className="mb-2 text-2xl font-bold text-emerald-400">
          {status === 'completed' ? 'Scan Complete!' : 'Processing your scan'}
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          {stage}
        </p>

        {/* Progress Bar */}
        {status === 'processing' && (
          <div className="w-full mb-6">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">{progress}% complete</p>
          </div>
        )}

        <div className="mb-6 w-full space-y-3 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white ${
                status === 'uploading' ? 'bg-emerald-500/40' : 'bg-emerald-600'
              }`}>
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Upload photos</p>
                <p className="text-xs text-slate-500">
                  {status === 'uploading' ? 'In progress' : 'Complete'}
                </p>
              </div>
            </div>
            {status !== 'uploading' && <span className="text-emerald-400">✓</span>}
            {status === 'uploading' && <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400"></span>}
          </div>

          <div className="flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                status === 'processing' || status === 'completed' ? 'bg-emerald-500/40 text-emerald-200' : 'bg-slate-700 text-slate-500'
              }`}>
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Process scan</p>
                <p className="text-xs text-slate-500">
                  {status === 'completed' ? 'Complete' : status === 'processing' ? 'In progress' : 'Waiting'}
                </p>
              </div>
            </div>
            {status === 'completed' && <span className="text-emerald-400">✓</span>}
            {status === 'processing' && <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400"></span>}
          </div>
        </div>

        {/* Start Processing Button */}
        {status === 'uploaded' && (
          <button
            onClick={handleStartProcessing}
            className="w-full mb-6 py-4 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-center">
              <span className="text-xl mr-3">🚀</span>
              Start Processing
            </div>
          </button>
        )}

        <div className="w-full rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 text-left">
          <p className="text-sm font-semibold text-slate-200">What happens now?</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>• Mapping each room and identifying furniture</li>
            <li>• Detecting appliances and creating inventory</li>
            <li>• Building a personalized summary</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            This usually takes under a minute. You can leave the page — we&apos;ll keep processing.
          </p>
        </div>
      </div>
    </div>
  );
}