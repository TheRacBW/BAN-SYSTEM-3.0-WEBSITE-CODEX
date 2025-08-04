import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AccessCacheManager } from '../../utils/accessCacheManager';

interface CacheStats {
  cacheSize: number;
  userCache: any;
  lastUpdate: string;
}

export const CacheStatusIndicator: React.FC = () => {
  const { user } = useAuth();
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    const updateStats = () => {
      const cacheSize = AccessCacheManager.getCacheSize();
      const userCache = AccessCacheManager.exportCache(user.id);
      
      setCacheStats({
        cacheSize,
        userCache,
        lastUpdate: new Date().toLocaleTimeString()
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [user]);

  if (!user || !isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50"
        title="Show Cache Status"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold">Cache Status</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      {cacheStats && (
        <div className="text-xs space-y-2">
          <div>
            <span className="text-gray-400">Total Cache Entries:</span>
            <span className="ml-2">{cacheStats.cacheSize}</span>
          </div>
          
          {cacheStats.userCache && (
            <>
              <div>
                <span className="text-gray-400">User Cache Pages:</span>
                <span className="ml-2">{Object.keys(cacheStats.userCache.pageAccess || {}).length}</span>
              </div>
              
              <div>
                <span className="text-gray-400">Trust Level:</span>
                <span className="ml-2">{cacheStats.userCache.trustLevel}</span>
              </div>
              
              <div>
                <span className="text-gray-400">Discord Verified:</span>
                <span className="ml-2">{cacheStats.userCache.discordVerified ? 'Yes' : 'No'}</span>
              </div>
              
              <div>
                <span className="text-gray-400">Last Update:</span>
                <span className="ml-2">{cacheStats.lastUpdate}</span>
              </div>
            </>
          )}
          
          <div className="pt-2 border-t border-gray-600">
            <button
              onClick={() => {
                if (user) {
                  AccessCacheManager.invalidateCache(user.id);
                  alert('Cache cleared!');
                }
              }}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
};