import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { scanAPI } from '../../api/scan';
import type { ScanDetailsResponse } from '../../types';

export function ScanSummaryPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [scanDetails, setScanDetails] = useState<ScanDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (!scanId) {
      navigate('/history');
      return;
    }

    const loadScanDetails = async () => {
      try {
        setIsLoading(true);
        const data = await scanAPI.getScanDetails(scanId);
        console.log('📊 Received scan details:', data);
        console.log('🏠 House info:', data.house);
        console.log('🚪 Rooms:', data.rooms);
        console.log('📸 Images:', data.images);
        console.log('📝 Summary:', data.summary);
        console.log('💰 Cost info:', data.summary?.costSummary);
        setScanDetails(data);
        setError('');
      } catch (err: any) {
        setError('Failed to load scan details');
        console.error('❌ Error loading scan details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadScanDetails();
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

  // Extract computed data
  const totalRooms = scanDetails?.rooms.length ?? 0;
  const totalProducts = scanDetails?.summary?.summaryJson?.products 
    ? Object.keys(scanDetails.summary.summaryJson.products).reduce((count, roomId) => {
        const roomProducts = scanDetails.summary?.summaryJson.products[roomId];
        return count + (roomProducts?.booleans_true?.length || 0);
      }, 0)
    : 0;
  const prosConsList = scanDetails?.summary?.prosConsJson || { pros: [], cons: [] };
  const houseTypes = scanDetails?.detectedHouseTypes || [];
  
  // Extract house checklist data
  const houseData = scanDetails?.summary?.summaryJson?.house || { booleans_true: [], categoricals: {} };
  
  // Extract rooms data
  const roomsData = scanDetails?.summary?.summaryJson?.rooms || {};
  
  // Extract products data  
  const productsData = scanDetails?.summary?.summaryJson?.products || {};
  
  // Extract checklist metadata for title lookups
  const checklistMetadata = scanDetails?.summary?.summaryJson?.checklist_metadata || {
    house: {},
    rooms: {},
    products: {}
  };

  // Helper function to format item names with metadata lookup
  const formatItemName = (itemId: string, scope: 'house' | 'rooms' | 'products' = 'house') => {
    // First, try to get the title from metadata
    const metadata = checklistMetadata[scope]?.[itemId];
    if (metadata?.title) {
      return metadata.title;
    }
    
    // Fallback to formatting the ID
    return itemId
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

  if (error || !scanDetails) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-300 mb-2">Error</h2>
        <p className="text-slate-400 mb-6">{error || 'Scan not found'}</p>
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
          <div className="w-16"></div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* 1. HOUSE LEVEL DATA - Overview */}
        <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 rounded-xl p-6 border border-emerald-500/30 shadow-lg">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">🏠</span>
                <h2 className="text-2xl font-bold text-slate-100">
                  {scanDetails.house.address || `Scan ${scanDetails.id.slice(0, 8)}`}
                </h2>
              </div>
              {houseTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {houseTypes.map((type) => (
                    <span key={type} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium capitalize">
                      {type}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              scanDetails.status === 'succeeded' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : scanDetails.status === 'running'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {scanDetails.status.toUpperCase()}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
            <span>📅</span>
            <span>{formatDate(scanDetails.finishedAt || scanDetails.createdAt)}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-700/40 rounded-lg border border-slate-600/30">
              <div className="text-3xl font-bold text-emerald-400">
                {totalRooms}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">Rooms</div>
            </div>
            <div className="text-center p-4 bg-slate-700/40 rounded-lg border border-slate-600/30">
              <div className="text-3xl font-bold text-emerald-400">
                {totalProducts}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">Products</div>
            </div>
            <div className="text-center p-4 bg-slate-700/40 rounded-lg border border-slate-600/30">
              <div className="text-3xl font-bold text-emerald-400">
                {scanDetails.images.length}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">Images</div>
            </div>
          </div>
        </div>

        {/* 2. HOUSE LEVEL CHECKLIST */}
        {houseData && (houseData.booleans_true?.length > 0 || Object.keys(houseData.categoricals || {}).length > 0) && (
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span>📋</span>
              House-Level Checklist
            </h3>
            
            {/* Boolean Issues */}
            {houseData.booleans_true?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-2 uppercase tracking-wide">Issues Detected:</h4>
                <div className="space-y-2">
                  {houseData.booleans_true.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-300 bg-orange-500/10 px-3 py-2 rounded border border-orange-500/20">
                      <span className="text-orange-400">⚠️</span>
                      <span className="text-sm">{formatItemName(item, 'house')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Categorical Assessments */}
            {Object.keys(houseData.categoricals || {}).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wide">Assessments:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(houseData.categoricals).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center bg-slate-700/30 px-3 py-2 rounded">
                      <span className="text-sm text-slate-300">{formatItemName(key, 'house')}:</span>
                      <span className={`text-sm font-semibold px-2 py-1 rounded ${
                        value === 'Good' ? 'bg-green-500/20 text-green-400' :
                        value === 'Average' ? 'bg-yellow-500/20 text-yellow-400' :
                        value === 'Poor' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-600/30 text-slate-400'
                      }`}>
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. ALL IMAGES GALLERY */}
        {scanDetails.images && scanDetails.images.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
              <span>📸</span>
              Complete Image Gallery ({scanDetails.images.length})
            </h2>
            
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              {/* Main Image Display */}
              <div className="relative mb-4">
                <img
                  src={scanDetails.images[currentImageIndex].url}
                  alt={`Scan image ${currentImageIndex + 1}`}
                  className="w-full h-64 md:h-96 object-contain bg-slate-900/50 rounded-lg"
                />
                
                {scanDetails.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => 
                        prev > 0 ? prev - 1 : scanDetails.images.length - 1
                      )}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-lg"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => 
                        prev < scanDetails.images.length - 1 ? prev + 1 : 0
                      )}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-lg"
                    >
                      →
                    </button>
                    
                    <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                      {currentImageIndex + 1} / {scanDetails.images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail Grid */}
              {scanDetails.images.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {scanDetails.images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                        index === currentImageIndex 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/50 scale-105' 
                          : 'border-slate-600/50 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. ROOMS LEVEL - Detailed breakdown */}
        {scanDetails.rooms && scanDetails.rooms.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
              <span>🚪</span>
              Rooms Analysis
            </h2>
            
            {scanDetails.rooms.map((room) => {
              const roomChecklist = roomsData[room.id] || { booleans_true: [], categoricals: {} };
              const roomProducts = productsData[room.id] || { booleans_true: [], categoricals: {} };
              
              return (
                <div key={room.id} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                  {/* Room Header */}
                  <div className="mb-4 pb-4 border-b border-slate-700/50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-100">{room.label}</h3>
                        {room.detectedRoomTypes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {room.detectedRoomTypes.map((type) => (
                              <span key={type} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium capitalize">
                                {type}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs font-medium">
                        {room.images.length} {room.images.length === 1 ? 'image' : 'images'}
                      </span>
                    </div>
                    
                    {/* Room Images */}
                    {room.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {room.images.map((image) => (
                          <img
                            key={image.id}
                            src={image.url}
                            alt={room.label}
                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border-2 border-slate-600/30"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Room Issues Checklist */}
                  {(roomChecklist.booleans_true?.length > 0 || Object.keys(roomChecklist.categoricals || {}).length > 0) && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wide">Room Issues & Conditions:</h4>
                      
                      {/* Boolean Issues */}
                      {roomChecklist.booleans_true?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-orange-400 mb-2 font-semibold">Issues Found:</p>
                          <div className="space-y-2">
                            {roomChecklist.booleans_true.map((item: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-slate-300 bg-orange-500/10 px-3 py-2 rounded border border-orange-500/20">
                                <span className="text-orange-400">⚠️</span>
                                <span className="text-sm">{formatItemName(item, 'rooms')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Categorical Assessments */}
                      {Object.keys(roomChecklist.categoricals || {}).length > 0 && (
                        <div>
                          <p className="text-xs text-blue-400 mb-2 font-semibold">Condition Ratings:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(roomChecklist.categoricals).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center bg-slate-700/30 px-3 py-2 rounded">
                                <span className="text-sm text-slate-300">{formatItemName(key, 'rooms')}:</span>
                                <span className={`text-sm font-semibold px-2 py-1 rounded ${
                                  value === 'Good' ? 'bg-green-500/20 text-green-400' :
                                  value === 'Average' ? 'bg-yellow-500/20 text-yellow-400' :
                                  value === 'Poor' ? 'bg-red-500/20 text-red-400' :
                                  'bg-slate-600/30 text-slate-400'
                                }`}>
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Products Checklist for this Room */}
                  {(roomProducts.booleans_true?.length > 0 || Object.keys(roomProducts.categoricals || {}).length > 0) && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wide">Products Found:</h4>
                      
                      {/* Products Present */}
                      {roomProducts.booleans_true?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-emerald-400 mb-2 font-semibold">
                            {roomProducts.booleans_true.length} Product(s) Detected:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {roomProducts.booleans_true.map((item: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium border border-emerald-500/30">
                                {formatItemName(item, 'products')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Product Conditions */}
                      {Object.keys(roomProducts.categoricals || {}).length > 0 && (
                        <div>
                          <p className="text-xs text-blue-400 mb-2 font-semibold">Product Conditions:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(roomProducts.categoricals)
                              .filter(([_, value]) => value !== 'N/A')
                              .map(([key, value]) => (
                                <div key={key} className="flex justify-between items-center bg-slate-700/30 px-3 py-2 rounded">
                                  <span className="text-sm text-slate-300">{formatItemName(key, 'products')}:</span>
                                  <span className={`text-sm font-semibold px-2 py-1 rounded ${
                                    value === 'Good' ? 'bg-green-500/20 text-green-400' :
                                    value === 'Average' ? 'bg-yellow-500/20 text-yellow-400' :
                                    value === 'Poor' || value === 'Dented' ? 'bg-red-500/20 text-red-400' :
                                    'bg-slate-600/30 text-slate-400'
                                  }`}>
                                    {String(value)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 4. PROS & CONS */}
        {(prosConsList.pros?.length > 0 || prosConsList.cons?.length > 0) && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
              <span>⚖️</span>
              Overall Assessment
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pros */}
              {prosConsList.pros?.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 rounded-xl p-5 border border-emerald-500/30">
                  <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                    <span className="text-2xl">✓</span>
                    Strengths ({prosConsList.pros.length})
                  </h3>
                  <ul className="space-y-3">
                    {prosConsList.pros.map((pro: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="text-emerald-400 mt-1 flex-shrink-0">●</span>
                        <span className="text-sm text-slate-200 leading-relaxed">{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {prosConsList.cons?.length > 0 && (
                <div className="bg-gradient-to-br from-orange-900/20 to-orange-800/10 rounded-xl p-5 border border-orange-500/30">
                  <h3 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
                    <span className="text-2xl">⚠</span>
                    Areas for Improvement ({prosConsList.cons.length})
                  </h3>
                  <ul className="space-y-3">
                    {prosConsList.cons.map((con: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="text-orange-400 mt-1 flex-shrink-0">●</span>
                        <span className="text-sm text-slate-200 leading-relaxed">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. COST & USAGE DETAILS */}
        {scanDetails.summary?.costSummary && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
              <span>💰</span>
              Processing Cost & Usage
            </h2>
            
            <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 rounded-xl p-6 border border-slate-700/50">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {scanDetails.summary.costSummary.tokens && (
                  <>
                    <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">
                        {scanDetails.summary.costSummary.tokens.total_tokens?.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Total Tokens</div>
                    </div>
                    <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                      <div className="text-2xl font-bold text-green-400">
                        {scanDetails.summary.costSummary.tokens.prompt_tokens?.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Input Tokens</div>
                    </div>
                    <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                      <div className="text-2xl font-bold text-purple-400">
                        {scanDetails.summary.costSummary.tokens.completion_tokens?.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Output Tokens</div>
                    </div>
                  </>
                )}
                {scanDetails.summary.costSummary.costs?.total_estimated_usd && (
                  <div className="text-center p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                    <div className="text-2xl font-bold text-emerald-400">
                      ${scanDetails.summary.costSummary.costs.total_estimated_usd.toFixed(4)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Est. Cost (USD)</div>
                  </div>
                )}
              </div>

              {/* Performance Metrics */}
              {scanDetails.summary.costSummary.session && (
                <div className="mb-6 pb-6 border-b border-slate-700/50">
                  <h4 className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wide">Performance Metrics:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-slate-700/20 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Processing Time</div>
                      <div className="text-lg font-bold text-slate-200">
                        {scanDetails.summary.costSummary.session.duration_seconds?.toFixed(2)}s
                      </div>
                    </div>
                    <div className="bg-slate-700/20 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Tokens/Second</div>
                      <div className="text-lg font-bold text-slate-200">
                        {scanDetails.summary.costSummary.session.tokens_per_second?.toFixed(0)}
                      </div>
                    </div>
                    {scanDetails.summary.costSummary.requests && (
                      <div className="bg-slate-700/20 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">API Requests</div>
                        <div className="text-lg font-bold text-slate-200">
                          {scanDetails.summary.costSummary.requests.total_requests}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Agent Breakdown */}
              {scanDetails.agentRuns && scanDetails.agentRuns.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wide flex items-center justify-between">
                    <span>Agent Execution Details:</span>
                    <span className="text-xs font-normal text-slate-400">({scanDetails.agentRuns.length} agents)</span>
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {scanDetails.agentRuns.map((agent, idx) => (
                      <div key={agent.id} className="bg-slate-700/20 rounded-lg p-3 border border-slate-600/30">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-200">{agent.agentName}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(agent.startedAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Input:</span>
                            <span className="text-slate-200 font-medium">{agent.tokensIn.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Output:</span>
                            <span className="text-slate-200 font-medium">{agent.tokensOut.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Pricing Note */}
              {scanDetails.summary.costSummary.costs?.pricing_note && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300">
                    ℹ️ {scanDetails.summary.costSummary.costs.pricing_note}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
