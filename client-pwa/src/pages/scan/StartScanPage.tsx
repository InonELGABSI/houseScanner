import { useState } from 'react';
import { useScan } from '../../context/ScanContext';

export function StartScanPage() {
  const { dispatch } = useScan();
  const [address, setAddress] = useState('');

  const handleStartScan = () => {
    // Store address in context if provided
    if (address.trim()) {
      dispatch({ 
        type: 'SET_SCAN_INFO', 
        payload: { 
          scanId: '', // Will be created in ProcessingPage
          address: address.trim()
        } 
      });
    }
    dispatch({ type: 'START_SCAN' });
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
      {/* House Animation Placeholder */}
      <div className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-glow-lg flex items-center justify-center animate-pulse">
        <span className="text-5xl">🏠</span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent mb-4">
        House Scanner
      </h1>
      
      <p className="text-slate-400 text-lg mb-8 max-w-sm">
        Capture photos of your house rooms to get a detailed analysis and checklist
      </p>

      {/* Address Input (Optional) */}
      <div className="w-full max-w-sm mb-6">
        <label htmlFor="address" className="block text-left text-sm font-medium text-slate-300 mb-2">
          House Address <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, City, State"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Start Button */}
      <button
        onClick={handleStartScan}
        className="w-full max-w-sm py-4 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="flex items-center justify-center">
          <span className="text-xl mr-3">📷</span>
          Start House Scan
        </div>
      </button>

      {/* Info */}
      <div className="mt-8 text-sm text-slate-500">
        <p>Take photos of each room in your house</p>
        <p>Get AI-powered analysis and recommendations</p>
      </div>
    </div>
  );
}