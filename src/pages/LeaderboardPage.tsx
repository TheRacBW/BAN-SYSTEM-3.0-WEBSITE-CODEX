import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, Trophy, Clock, Wifi, WifiOff } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { TabType } from '../types/leaderboard';
import LeaderboardEntryComponent from '../components/leaderboard/LeaderboardEntry';
import StatsCard from '../components/leaderboard/StatsCard';
import { TestLeaderboardData } from '../components/TestLeaderboardData';

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
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
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
                  <div>
                    <select
                      className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      value={activeTab === 'gainers' ? gainersTimeRange : losersTimeRange}
                      onChange={e => activeTab === 'gainers' ? setGainersTimeRange(e.target.value as any) : setLosersTimeRange(e.target.value as any)}
                    >
                      {timeRangeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                  {(activeTab === 'gainers' ? isLoadingGainers : isLoadingLosers) ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                  ) : (
                    (activeTab === 'gainers' ? gainers : losers).length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">No data found for this period.</div>
                    ) : (
                      (activeTab === 'gainers' ? gainers : losers).map((entry, idx) => (
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
                            <div className={`font-bold text-lg ${activeTab === 'gainers' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {entry.rp_change > 0 ? '+' : ''}{entry.rp_change} RP ({entry.percentage_change.toFixed(1)}%)
                            </div>
                          </div>
                        </div>
                      ))
                    )
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