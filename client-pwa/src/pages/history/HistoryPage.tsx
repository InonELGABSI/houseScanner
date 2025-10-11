import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanAPI } from '../../api/scan';

interface HistoryItem {
  id: string;
  address?: string;
  date: string;
  status: string;
  totalRooms: number;
  totalProducts: number;
  thumbnail?: string;
}

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const data = await scanAPI.getScanHistory();
      // Transform the API response to match our HistoryItem interface
      const transformedData: HistoryItem[] = data.map(item => ({
        id: item.id,
        address: item.address,
        date: item.createdAt,
        status: item.status,
        totalRooms: 0, // Will be populated from detailed scan data
        totalProducts: 0, // Will be populated from detailed scan data
      }));
      setHistory(transformedData);
      setError('');
    } catch (err: any) {
      setError('Failed to load scan history');
      console.error('Error loading history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanClick = (scanId: string) => {
    navigate(`/summary/${scanId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-300">Loading history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-300 mb-2">Error</h2>
        <p className="text-slate-400 mb-6">{error}</p>
        <button
          onClick={loadHistory}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent mb-2">
          Scan History
        </h1>
        <p className="text-slate-400">View your previous house scans</p>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 flex items-center justify-center mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Scans Yet</h3>
          <p className="text-slate-400 text-sm mb-6">
            Start your first house scan to see it here
          </p>
          <button
            onClick={() => navigate('/scan')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            Start First Scan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => handleScanClick(item.id)}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 hover:bg-slate-700/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center space-x-4">
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg flex items-center justify-center flex-shrink-0">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt="Scan thumbnail"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">🏠</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-slate-200 font-medium truncate">
                      {item.address || `Scan ${item.id.slice(0, 8)}`}
                    </h3>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {formatDate(item.date)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-slate-400">
                      <span>{item.totalRooms} rooms</span>
                      <span>{item.totalProducts} items</span>
                    </div>
                    
                    <div className="flex items-center text-slate-400 group-hover:text-slate-300 transition-colors">
                      <span className="text-sm mr-1">View</span>
                      <span className="text-lg">→</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      item.status === 'completed' 
                        ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                        : item.status === 'processing'
                        ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
                        : 'bg-red-900/30 text-red-400 border border-red-700/30'
                    }`}>
                      {item.status === 'completed' && '✓ Complete'}
                      {item.status === 'processing' && '⏳ Processing'}
                      {item.status === 'failed' && '⚠️ Failed'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      {history.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={loadHistory}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      )}
    </div>
  );
}