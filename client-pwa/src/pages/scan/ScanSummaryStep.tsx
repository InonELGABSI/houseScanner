import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScan } from '../../context/ScanContext';
import { scanAPI } from '../../api/scan';

interface ScanDetailsResponse {
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

export function ScanSummaryStep() {
  const { state, dispatch } = useScan();
  const navigate = useNavigate();
  const [scanDetails, setScanDetails] = useState<ScanDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchScanDetails = async () => {
      if (!state.scanId) {
        setError('Missing scan identifier');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await scanAPI.getScanDetails(state.scanId);
        setScanDetails(data);
        setError('');
      } catch (err) {
        console.error('Failed to load scan details', err);
        setError('Unable to fetch scan details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScanDetails();
  }, [state.scanId]);

  const handleViewFullSummary = () => {
    if (!state.scanId) return;
    navigate(`/summary/${state.scanId}`);
  };

  const handleStartAgain = () => {
    dispatch({ type: 'CANCEL_SCAN' });
    dispatch({ type: 'SET_PHASE', payload: 'idle' });
  };

  const handleGoToHistory = () => {
    navigate('/history');
  };

  const thumbnails = (summary?.images || []).slice(0, 4).map(url => ({ url }));

  return (
    <div className="min-h-full px-4 pb-6">
      <header className="sticky top-0 z-10 -mx-4 border-b border-slate-700/40 bg-slate-900/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Step 2 of 2 · Summary
          </span>
          <button
            onClick={handleStartAgain}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            New scan
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-slate-300">Fetching your scan summary…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
          <span className="text-4xl">⚠️</span>
          <div>
            <p className="text-lg font-semibold text-red-300">{error}</p>
            <p className="text-sm text-slate-400">Try again from the history page.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGoToHistory}
              className="rounded-lg border border-slate-600/60 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              View history
            </button>
            <button
              onClick={handleStartAgain}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Start new scan
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-6 flex max-w-md flex-col space-y-6">
          <section className="rounded-2xl border border-emerald-500/20 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Scan ID</p>
                <p className="text-lg font-semibold text-slate-100">
                  {summary?.address || summary?.id.slice(0, 8)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Captured</p>
                <p className="text-sm font-medium text-slate-300">
                  {summary ? new Date(summary.date).toLocaleString() : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-800/80 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {summary?.totalRooms ?? 0}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-400">Rooms</p>
              </div>
              <div className="rounded-xl bg-slate-800/80 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {summary?.totalProducts ?? 0}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-400">Items</p>
              </div>
            </div>
          </section>

          {thumbnails.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Quick gallery
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {thumbnails.map(({ url }, index) => (
                  <div key={url + index} className="relative overflow-hidden rounded-xl">
                    <img src={url} alt={`Scan image ${index + 1}`} className="h-28 w-full object-cover" />
                    {index === 3 && summary && summary.images.length > 4 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-white">
                        +{summary.images.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary?.summary && (
            <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Highlights
              </h3>
              <p className="text-sm leading-relaxed text-slate-300">{summary.summary}</p>
            </section>
          )}

          {summary?.recommendations?.length ? (
            <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Recommendations
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {summary.recommendations.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="space-y-3">
            <button
              onClick={handleViewFullSummary}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Open full summary
            </button>
            <button
              onClick={handleGoToHistory}
              className="w-full rounded-xl border border-slate-700/60 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              View all scans
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
