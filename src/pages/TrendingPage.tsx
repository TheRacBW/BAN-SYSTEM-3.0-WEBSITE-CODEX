import React, { useState, useEffect } from 'react';
import { useKits } from '../context/KitContext';
import StrategyBrowser from '../components/StrategyBrowser';
import StrategyModal from '../components/StrategyModal';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useKitReload } from '../hooks/useKitReload';

function TrendingPage() {
  const { strategies, selectedStrategyId, selectStrategy } = useKits();
  const { hasKits, loading: kitsLoading } = useKitReload();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<any>(null);

  // Clear selected strategy on component mount
  useEffect(() => {
    selectStrategy(null);
  }, [selectStrategy]);

  // Verify strategy exists in Supabase before showing modal
  const verifyStrategy = async (strategyId: string) => {
    try {
      const { data, error: queryError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (queryError) {
        // If the error is PGRST116 (no rows), return false instead of throwing
        if (queryError.code === 'PGRST116') {
          return null;
        }
        throw queryError;
      }

      return data;
    } catch (error) {
      console.error('Error verifying strategy:', error);
      return null;
    }
  };

  const handleStrategyClick = async (strategyId: string) => {
    try {
      setLoading(true);
      setError(null);

      // First check if strategy exists in local state
      const localStrategy = strategies.find(s => s.id === strategyId);
      if (!localStrategy) {
        setError('Strategy not found in local state');
        return;
      }

      // Then verify it exists in Supabase and get fresh data
      const dbStrategy = await verifyStrategy(strategyId);
      if (!dbStrategy) {
        setError('This strategy is not available in the database. It may have been deleted or is still being synchronized.');
        return;
      }

      // Combine local and DB data
      const fullStrategy = {
        ...localStrategy,
        ...dbStrategy,
        createdAt: new Date(dbStrategy.created_at),
        updatedAt: new Date(dbStrategy.updated_at || dbStrategy.created_at),
        kits: dbStrategy.kit_ids,
        winRate: dbStrategy.win_rate,
        isPublic: dbStrategy.is_public
      };

      setCurrentStrategy(fullStrategy);
      selectStrategy(strategyId);
      setShowModal(true);
    } catch (err) {
      console.error('Error loading strategy:', err);
      setError(err instanceof Error ? err.message : 'Unable to load the strategy. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setError(null);
    selectStrategy(null);
    setCurrentStrategy(null);
  };

  const handleDeleteStrategy = (strategyId: string) => {
    // Close modal if the deleted strategy was being viewed
    if (currentStrategy?.id === strategyId) {
      handleCloseModal();
    }
  };

  if (kitsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!hasKits) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Game Data</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch the latest kit information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Trending Strategies</h1>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <StrategyBrowser 
            onStrategyClick={handleStrategyClick} 
            isLoading={loading}
          />
        </div>
      </div>

      {showModal && currentStrategy && (
        <StrategyModal 
          strategy={currentStrategy} 
          onClose={handleCloseModal} 
        />
      )}
    </div>
  );
}

export default TrendingPage;