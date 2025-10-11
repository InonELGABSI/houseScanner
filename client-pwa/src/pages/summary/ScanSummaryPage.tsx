import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { scanAPI } from '../../api/scan';

interface DetailedSummary {
  id: string;
  address?: string;
  date: string;
  status: string;
  totalRooms: number;
  totalProducts: number;
  images: string[];
  summary: string;
  recommendations: string[];
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    products: Record<string, boolean>;
    images: string[];
  }>;
  decisions: Array<{
    roomId: string;
    productName: string;
    shouldStay: boolean;
  }>;
}

export function ScanSummaryPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DetailedSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (!scanId) {
      navigate('/history');
      return;
    }

    const loadSummary = async () => {
      try {
        setIsLoading(true);
        const data = await scanAPI.getScanSummary(scanId);
        setSummary(data);
        setError('');
      } catch (err: any) {
        setError('Failed to load scan summary');
        console.error('Error loading summary:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, [scanId, navigate]);

  const handleBack = () => {
    navigate('/history');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatProductName = (productName: string) => {
    return productName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-300">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-300 mb-2">Error</h2>
        <p className="text-slate-400 mb-6">{error || 'Summary not found'}</p>
        <button
          onClick={handleBack}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
        >
          ← Back to History
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-4">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800/90 backdrop-blur-sm border-b border-slate-700/50 p-4 z-10">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={handleBack}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-slate-200">Scan Summary</h1>
          <div className="w-16"></div> {/* Spacer */}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* Basic Info */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-200">
              {summary.address || `Scan ${summary.id.slice(0, 8)}`}
            </h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              summary.status === 'completed' 
                ? 'bg-green-900/30 text-green-400'
                : 'bg-yellow-900/30 text-yellow-400'
            }`}>
              {summary.status}
            </span>
          </div>
          
          <p className="text-sm text-slate-400 mb-4">
            {formatDate(summary.date)}
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-emerald-400">
                {summary.totalRooms}
              </div>
              <div className="text-xs text-slate-400">Rooms</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-emerald-400">
                {summary.totalProducts}
              </div>
              <div className="text-xs text-slate-400">Items</div>
            </div>
          </div>
        </div>

        {/* Images Carousel */}
        {summary.images && summary.images.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              📸 Images ({summary.images.length})
            </h3>
            
            <div className="relative">
              <img
                src={summary.images[currentImageIndex]}
                alt={`Scan image ${currentImageIndex + 1}`}
                className="w-full h-48 object-cover rounded-lg"
              />
              
              {summary.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => 
                      prev > 0 ? prev - 1 : summary.images.length - 1
                    )}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => 
                      prev < summary.images.length - 1 ? prev + 1 : 0
                    )}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center"
                  >
                    →
                  </button>
                  
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    {currentImageIndex + 1} / {summary.images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-200 mb-3">
            📋 Summary
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            {summary.summary}
          </p>
        </div>

        {/* Recommendations */}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">
              💡 Recommendations
            </h3>
            <ul className="space-y-2">
              {summary.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-slate-300">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Room Breakdown */}
        {summary.rooms && summary.rooms.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">
              🏠 Room Details
            </h3>
            
            {summary.rooms.map((room) => {
              const existingProducts = Object.entries(room.products).filter(([_, exists]) => exists);
              const roomDecisions = summary.decisions?.filter(d => d.roomId === room.id) || [];
              
              return (
                <div key={room.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3">
                    🚪 {room.name}
                  </h4>
                  
                  {existingProducts.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-slate-300 mb-2">Products:</h5>
                      {existingProducts.map(([productName]) => {
                        const decision = roomDecisions.find(d => d.productName === productName);
                        const isStaying = decision ? decision.shouldStay : true;
                        
                        return (
                          <div key={productName} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">{formatProductName(productName)}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              isStaying 
                                ? 'bg-green-900/30 text-green-400' 
                                : 'bg-red-900/30 text-red-400'
                            }`}>
                              {isStaying ? '✓ Stays' : '✗ Goes'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/scan')}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            Start New Scan
          </button>
          
          <button
            onClick={handleBack}
            className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
          >
            Back to History
          </button>
        </div>
      </div>
    </div>
  );
}