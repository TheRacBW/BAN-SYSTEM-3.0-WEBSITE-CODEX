import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, Trophy, Clock, Wifi, WifiOff } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { TabType } from '../types/leaderboard';
import LeaderboardEntryComponent from '../components/leaderboard/LeaderboardEntry';
import StatsCard from '../components/leaderboard/StatsCard';
import { TestLeaderboardData } from '../components/TestLeaderboardData';
import { robloxApi } from '../services/robloxApi';

const LeaderboardPage: React.FC = () => {
  const {
    entries,
    previousEntries,
    isLoading,
    isInitialLoading,
    error,
    lastUpdate,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    isLive,
    isRefreshing,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
    gainers,
    losers,
    gainersTimeRange,
    setGainersTimeRange,
    losersTimeRange,
    setLosersTimeRange,
    isLoadingGainers,
    isLoadingLosers
  } = useLeaderboard();

  const [showTest, setShowTest] = useState(true); // Temporarily show test

  // Time range options
  const timeRangeOptions = [
    { value: '12h', label: '12 Hours' },
    { value: '1d', label: '1 Day' },
    { value: '2d', label: '2 Days' }
  ];

  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'main', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'gainers', label: 'Hottest Gainers', icon: <TrendingUp size={20} /> },
    { id: 'losers', label: 'Biggest Losers', icon: <TrendingDown size={20} /> }
  ];

  // Debug: Clear cache
  const handleClearCache = () => {
    robloxApi.clearCache();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('robloxUserIdCache');
      localStorage.removeItem('robloxProfilePicCache');
    }
    refresh();
  };

  // Show test component first
  if (showTest) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaderboard Data Test</h1>
            <button
              onClick={() => setShowTest(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Show Real Leaderboard
            </button>
          </div>
          <TestLeaderboardData />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <WifiOff size={48} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Failed to load leaderboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- Modern Gainers/Losers Helpers ---
  const getDisplayPercentage = (player: any) => {
    const previousRP = player.previous_rp;
    const rpChange = player.rp_change;
    console.log(`🔍 Calculating percentage for ${player.username}:`, {
      previous_rp: previousRP,
      rp_change: rpChange,
      current_rp: player.current_rp
    });
    if (previousRP === 0 || previousRP === null || previousRP === undefined) {
      return "New Player joins LB";
    }
    const percentage = (rpChange / previousRP) * 100;
    const roundedPercentage = Math.round(percentage * 10) / 10;
    return `${roundedPercentage > 0 ? '+' : ''}${roundedPercentage}%`;
  };

  const processGainersData = (allGainers: any[]) => {
    console.log('🔍 Processing gainers data:', allGainers);
    const validGainers = allGainers.filter(player => player.rp_change > 0);
    const newPlayers = validGainers.filter(player => player.previous_rp === 0 || player.previous_rp === null);
    const existingGainers = validGainers.filter(player => player.previous_rp > 0);
    console.log('📊 Filtered gainers:', {
      total: validGainers.length,
      existingGainers: existingGainers.length,
      newPlayers: newPlayers.length,
      existingGainersList: existingGainers.map(p => `${p.username}: +${p.rp_change}`),
      newPlayersList: newPlayers.map(p => `${p.username}: +${p.rp_change}`)
    });
    return { existingGainers, newPlayers };
  };

  const getFullRankTransition = (player: any) => {
    // Try to use calculated rank fields if available, else fallback to rank_title
    const prevRank = player.previous_calculated_rank || player.previous_rank_title || 'Unknown';
    const currRank = player.new_calculated_rank || player.current_rank_title || 'Unknown';
    const prevRP = player.previous_rp;
    const currRP = player.new_rp || player.current_rp;
    console.log(`🎯 Rank transition for ${player.username}:`, {
      prevRank, currRank, prevRP, currRP
    });
    if (prevRP === 0 || prevRP === null) {
      return `→ ${currRank} (${currRP} RP)`;
    }
    if (currRank === '[Not in Top 200]' || currRP === 0) {
      return `${prevRank} (${prevRP} RP) → Dropped from leaderboard`;
    }
    return `${prevRank} (${prevRP} RP) → ${currRank} (${currRP} RP)`;
  };

  const ModernGainerCard = ({ player, rank, isNewPlayer }: any) => (
    <div className={`
      group relative overflow-hidden rounded-xl border transition-all duration-300
      ${isNewPlayer 
        ? 'bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border-emerald-200/20 hover:border-emerald-300/40' 
        : 'bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-200/20 hover:border-green-300/40'
      }
      hover:shadow-lg hover:shadow-green-500/10 hover:scale-[1.02]
    `}>
      {/* Rank Badge */}
      <div className="absolute top-3 left-3">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
          ${rank <= 3 
            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg' 
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }
        `}>
          {rank}
        </div>
      </div>
      {/* Main Content */}
      <div className="pt-14 pb-4 px-4">
        {/* Username */}
        <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
          {player.username}
        </h3>
        {/* Rank Transition */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {getFullRankTransition(player)}
        </div>
        {/* RP Gain Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${isNewPlayer 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              }
            `}>
              +{player.rp_change} RP
            </div>
            {/* Percentage or Label */}
            <div className={`
              text-xs px-2 py-1 rounded
              ${isNewPlayer 
                ? 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400' 
                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
              }
            `}>
              {getDisplayPercentage(player)}
            </div>
          </div>
          {/* Trending Arrow */}
          <div className="text-green-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const ModernLoserCard = ({ player, rank }: any) => (
    <div className="group relative overflow-hidden rounded-xl border transition-all duration-300 bg-gradient-to-r from-red-500/5 to-orange-500/5 border-red-200/20 hover:border-red-300/40 hover:shadow-lg hover:shadow-red-500/10 hover:scale-[1.02]">
      {/* Rank Badge */}
      <div className="absolute top-3 left-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {rank}
        </div>
      </div>
      {/* Main Content */}
      <div className="pt-14 pb-4 px-4">
        {/* Username */}
        <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
          {player.username}
        </h3>
        {/* Rank Transition */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {getFullRankTransition(player)}
        </div>
        {/* RP Loss Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {player.rp_change} RP
            </div>
            {/* Percentage */}
            <div className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {getDisplayPercentage(player)}
            </div>
          </div>
          {/* Trending Arrow */}
          <div className="text-red-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  // --- Modern Gainers Section ---
  const renderGainersSection = () => {
    const { existingGainers, newPlayers } = processGainersData(gainers);
    return (
      <div className="space-y-6">
        {/* Existing Gainers */}
        {existingGainers.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top RP Gainers
              </h3>
              <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full text-xs font-medium">
                {existingGainers.length} active
              </div>
            </div>
            <div className="grid gap-3">
              {existingGainers.map((player, index) => (
                <ModernGainerCard 
                  key={player.username} 
                  player={player} 
                  rank={index + 1} 
                  isNewPlayer={false}
                />
              ))}
            </div>
          </div>
        )}
        {/* New Players */}
        {newPlayers.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                New to Leaderboard
              </h3>
              <div className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full text-xs font-medium">
                {newPlayers.length} fresh
              </div>
            </div>
            <div className="grid gap-3">
              {newPlayers.map((player, index) => (
                <ModernGainerCard 
                  key={player.username} 
                  player={player} 
                  rank={existingGainers.length + index + 1} 
                  isNewPlayer={true}
                />
              ))}
            </div>
          </div>
        )}
        {existingGainers.length === 0 && newPlayers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No RP gainers found in recent activity.</div>
        )}
      </div>
    );
  };

  // --- Modern Losers Section ---
  const renderLosersSection = () => {
    const validLosers = losers.filter((player: any) => player.rp_change < 0 && player.previous_rp > 0);
    console.log('📊 Filtered losers:', {
      total: losers.length,
      validLosers: validLosers.length,
      validLosersList: validLosers.map((p: any) => `${p.username}: ${p.rp_change}`)
    });
    return (
      <div className="space-y-3">
        {validLosers.length > 0 ? (
          validLosers.map((player, index) => (
            <ModernLoserCard 
              key={player.username} 
              player={player} 
              rank={index + 1}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No RP losses found in recent activity.</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Leaderboard
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span>Last updated: {formatLastUpdate(lastUpdate)}</span>
                </div>
                <div className={`flex items-center gap-2 ${isLive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
                  <span className="font-medium">{isLive ? 'LIVE' : 'OFFLINE'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Debug: Clear Cache Button (dev only) */}
            {process.env.NODE_ENV !== 'production' && (
              <button
                onClick={handleClearCache}
                className="ml-4 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-semibold text-xs shadow hover:bg-red-200 transition"
                title="Clear Roblox avatar cache (debug)"
              >
                Clear Avatar Cache
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const query = formData.get('search') as string;
            if (query.trim()) {
              setSearchQuery(query);
            } else {
              setSearchQuery('');
            }
          }}>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                name="search"
                placeholder="Search players..."
                defaultValue={searchQuery}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isInitialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <span className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4">🔄</span>
              <p className="text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 relative">
            {isRefreshing && (
              <div className="refresh-indicator">
                <span>Updating...</span>
              </div>
            )}
            {activeTab === 'main' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Top 200 Players
                  </h2>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {entries.length} players
                  </span>
                </div>
                {entries.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchQuery ? 'No players found matching your search.' : 'No players found.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 w-full">
                    {entries.map((entry, index) => (
                      <LeaderboardEntryComponent
                        key={entry.username}
                        entry={entry}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {(activeTab === 'gainers' || activeTab === 'losers') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {activeTab === 'gainers' ? 'Top RP Gainers' : 'Top RP Losers'}
                  </h2>
                  {/* Modern Segmented Control for Time Filter */}
                  <div className="time-filter-buttons">
                    {['6h', '12h', '1d', '2d'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`filter-button${((activeTab === 'gainers' ? gainersTimeRange : losersTimeRange) === opt) ? ' active' : ''}`}
                        onClick={() => activeTab === 'gainers' ? setGainersTimeRange(opt as any) : setLosersTimeRange(opt as any)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                  {(activeTab === 'gainers' ? isLoadingGainers : isLoadingLosers) ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                  ) : (
                    (() => {
                      const data = activeTab === 'gainers' ? gainers : losers;
                      if (!data || data.length === 0) {
                        const requested = (activeTab === 'gainers' ? gainersTimeRange : losersTimeRange);
                        const requestedHours = requested === '6h' ? 6 : requested === '12h' ? 12 : requested === '1d' ? 24 : 48;
                        return <div className="text-center py-8 text-gray-500 dark:text-gray-400">No RP changes found in the last {requestedHours} hours. Try a longer timeframe.</div>;
                      }
                      // Find the oldest inserted_at timestamp in the data
                      const timestamps = data.map(e => e.inserted_at ? new Date(e.inserted_at) : null).filter(Boolean) as Date[];
                      let oldest = null;
                      if (timestamps.length > 0) {
                        oldest = timestamps.reduce((min, d) => d < min ? d : min, timestamps[0]);
                      }
                      let periodMsg = '';
                      if (oldest) {
                        const now = new Date();
                        const hours = Math.round((now.getTime() - oldest.getTime()) / (1000 * 60 * 60));
                        const requested = (activeTab === 'gainers' ? gainersTimeRange : losersTimeRange);
                        const requestedHours = requested === '6h' ? 6 : requested === '12h' ? 12 : requested === '1d' ? 24 : 48;
                        if (hours < requestedHours) {
                          periodMsg = `Partial data: Only last ${hours} hours available for this period.`;
                        } else {
                          periodMsg = `Showing last ${requestedHours} hours of data.`;
                        }
                      }
                      return <>
                        {periodMsg && <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400">{periodMsg}</div>}
                        {data.map((entry, idx) => (
                          <div key={entry.username} className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                            <div className="flex items-center space-x-4">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {entry.username}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {entry.previous_rank_title} → {entry.current_rank_title}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold text-lg ${entry.rp_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {entry.rp_change > 0 ? '+' : ''}{entry.rp_change} RP ({getDisplayPercentage(entry)})
                              </div>
                            </div>
                          </div>
                        ))}
                      </>;
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage; 