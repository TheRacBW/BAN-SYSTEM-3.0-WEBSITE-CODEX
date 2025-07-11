import React, { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, TrendingUp, Swords, Shield, ToggleLeft } from 'lucide-react';
import { useKits } from '../context/KitContext';
import { useBan } from '../context/BanContext';
import { useAuth } from '../context/AuthContext';
import { Strategy, StrategyTag } from '../types';
import StrategyCard from './StrategyCard';
import { supabase } from '../lib/supabase';
import StrategyModal from './StrategyModal';

interface StrategyBrowserProps {
  onStrategyClick?: (strategyId: string) => void;
  isLoading?: boolean;
}

type SortOption = 'winRate' | 'popularity' | 'effectiveness' | 'counterability' | 'newest';

const StrategyBrowser: React.FC<StrategyBrowserProps> = ({ 
  onStrategyClick,
  isLoading = false
}) => {
  const { strategies, selectStrategy, selectedStrategyId, filterStrategies } = useKits();
  const { getValidStrategies } = useBan();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyValid, setShowOnlyValid] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showOnlyOwned, setShowOnlyOwned] = useState(false);
  const [selectedTags, setSelectedTags] = useState<StrategyTag[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('winRate');
  const [showFilters, setShowFilters] = useState(false);
  const [ownedKits, setOwnedKits] = useState<string[]>([]);
  const [inactiveStrategies, setInactiveStrategies] = useState<string[]>([]);
  const [modalStrategy, setModalStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    const fetchOwnedKits = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('owned_kits')
          .select('kit_id')
          .eq('user_id', user.id);

        if (error) throw error;
        setOwnedKits(data.map(item => item.kit_id));
      } catch (error) {
        console.error('Error fetching owned kits:', error);
      }
    };

    const fetchInactiveStrategies = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('strategy_tags')
          .select('strategy_id')
          .eq('user_id', user.id)
          .eq('is_active', false);

        if (error) throw error;
        setInactiveStrategies(data.map(item => item.strategy_id));
      } catch (error) {
        console.error('Error fetching inactive strategies:', error);
      }
    };

    if (user) {
      fetchOwnedKits();
      fetchInactiveStrategies();
    }
  }, [user]);

  let filteredStrategies = searchQuery ? filterStrategies(searchQuery) : strategies;
  
  if (showOnlyValid) {
    filteredStrategies = getValidStrategies(filteredStrategies, []);
  }

  if (showOnlyActive && user) {
    filteredStrategies = filteredStrategies.filter(strategy => 
      !inactiveStrategies.includes(strategy.id)
    );
  }

  if (showOnlyOwned) {
    filteredStrategies = filteredStrategies.filter(strategy => 
      strategy.kits.every(kitId => ownedKits.includes(kitId))
    );
  }

  if (selectedTags.length > 0) {
    filteredStrategies = filteredStrategies.filter(strategy => 
      selectedTags.every(tag => strategy.tags?.includes(tag))
    );
  }
  
  filteredStrategies = [...filteredStrategies].sort((a, b) => {
    switch (sortBy) {
      case 'winRate':
        return b.winRate - a.winRate;
      case 'popularity':
        return b.popularity - a.popularity;
      case 'effectiveness':
        return b.effectiveness - a.effectiveness;
      case 'counterability':
        return b.counterability - a.counterability;
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });

  const handleStrategyClick = (strategyId: string) => {
    if (isLoading) return;
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy) setModalStrategy(strategy);
    if (onStrategyClick) {
      onStrategyClick(strategyId);
    }
  };

  const handleTagToggle = (tag: StrategyTag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="flex justify-between items-center mb-4">
        <h2 className="panel-title">Strategy Browser</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>
      
      <div className="space-y-4 mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search strategies..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {showFilters && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="ml-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-1"
              >
                <option value="winRate">Win Rate</option>
                <option value="popularity">Popularity</option>
                <option value="effectiveness">Effectiveness</option>
                <option value="counterability">Counterability</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center">
                <Filter size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
                <label className="flex items-center cursor-pointer relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showOnlyValid}
                    onChange={() => setShowOnlyValid(!showOnlyValid)}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 
                    peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer 
                    dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white 
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
                    after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
                    after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    Show only valid strategies
                  </span>
                </label>
              </div>

              <div className="flex items-center">
                <ToggleLeft size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
                <label className="flex items-center cursor-pointer relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showOnlyActive}
                    onChange={() => setShowOnlyActive(!showOnlyActive)}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 
                    peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer 
                    dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white 
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
                    after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
                    after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    Show only active strategies
                  </span>
                </label>
              </div>

              <div className="flex items-center">
                <ToggleLeft size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
                <label className="flex items-center cursor-pointer relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showOnlyOwned}
                    onChange={() => setShowOnlyOwned(!showOnlyOwned)}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 
                    peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer 
                    dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white 
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
                    after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
                    after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    Show only strategies with owned kits
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter by tags:
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Rush', 'Late', 'Eco', 'Troll'] as StrategyTag[]).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                      ${selectedTags.includes(tag)
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-4 text-xs">
              <div className="flex items-center text-blue-600 dark:text-blue-400">
                <Swords size={14} className="mr-1" />
                Effectiveness
              </div>
              <div className="flex items-center text-amber-600 dark:text-amber-400">
                <Shield size={14} className="mr-1" />
                Counterability
              </div>
              <div className="flex items-center text-green-600 dark:text-green-400">
                <TrendingUp size={14} className="mr-1" />
                Win Rate
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {filteredStrategies.length > 0 ? (
          filteredStrategies.map(strategy => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              onClick={() => handleStrategyClick(strategy.id)}
              isSelected={strategy.id === selectedStrategyId}
              showTags={false}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No strategies found matching your criteria
          </div>
        )}
      </div>
      {/* Strategy Modal for rating, comments, players encountered */}
      {modalStrategy && (
        <StrategyModal
          strategy={modalStrategy}
          onClose={() => setModalStrategy(null)}
        />
      )}
    </div>
  );
};

export default StrategyBrowser;