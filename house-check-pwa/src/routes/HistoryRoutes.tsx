import { useListHistory } from '../api/hooks';
import { useScan } from '../context/ScanContext';

export function HistoryPage() {
  const historyQ = useListHistory();
  const { dispatch } = useScan();
  
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
          Scan History
        </h1>
        <p className="text-slate-400">View your previous house scans and analyses</p>
      </div>

      {/* Loading State */}
      {historyQ.isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg animate-pulse flex items-center justify-center">
            <span className="text-lg">📋</span>
          </div>
          <p className="text-slate-400">Loading your scan history...</p>
        </div>
      )}

      {/* Error State */}
      {historyQ.error && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-20 h-20 rounded-full bg-red-900/50 backdrop-blur-sm border border-red-700/50 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-300 mb-2">Error loading history</h3>
            <p className="text-slate-400 text-sm">Unable to load scan history. Please try again later.</p>
            <button 
              onClick={() => historyQ.refetch()}
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!historyQ.error && historyQ.data && Array.isArray(historyQ.data) && historyQ.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 flex items-center justify-center">
            <span className="text-3xl">📷</span>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No scans yet</h3>
            <p className="text-slate-400 text-sm">Start your first house scan to see results here</p>
          </div>
        </div>
      )}

      {/* History List */}
      {!historyQ.error && historyQ.data && Array.isArray(historyQ.data) && historyQ.data.length > 0 && (
        <div className="space-y-3">
          {historyQ.data.map((item, index) => (
            <div
              key={item.id}
              className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all duration-200 cursor-pointer"
              onClick={() => dispatch({ type: 'SET_ACTIVE_SUMMARY', payload: item.id })}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏠</span>
                    <h3 className="font-semibold text-slate-200">Scan #{historyQ.data!.length - index}</h3>
                  </div>
                  <div className="text-sm text-slate-400 mb-2">{item.createdAt}</div>
                  {item.houseTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.houseTypes.map((type, typeIndex) => (
                        <span
                          key={typeIndex}
                          className="px-2 py-1 bg-emerald-900/30 text-emerald-400 text-xs rounded-lg border border-emerald-700/30"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-300 transition-colors">
                  <span className="text-sm">View</span>
                  <span className="text-lg">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fallback for unexpected data format */}
      {!historyQ.error && historyQ.data && !Array.isArray(historyQ.data) && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-20 h-20 rounded-full bg-yellow-900/50 backdrop-blur-sm border border-yellow-700/50 flex items-center justify-center">
            <span className="text-3xl">🔧</span>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-yellow-300 mb-2">Unexpected data format</h3>
            <p className="text-slate-400 text-sm">The history data is not in the expected format.</p>
            <div className="mt-3 text-xs text-slate-500 bg-slate-800/50 p-2 rounded">
              Data type: {typeof historyQ.data}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
