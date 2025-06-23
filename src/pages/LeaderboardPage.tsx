import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, Trophy, Clock, Wifi, WifiOff } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { TabType } from '../types/leaderboard';
import LeaderboardEntryComponent from '../components/leaderboard/LeaderboardEntry';
import StatsCard from '../components/leaderboard/StatsCard';

const LeaderboardPage: React.FC = () => {
  const {
    entries,
    filteredEntries,
    hottestGainers,
    biggestLosers,
    lastUpdate,
    isLoading,
    error,
    searchQuery,
    activeTab,
    isLive,
    setSearchQuery,
    setActiveTab,
    refreshData
  } = useLeaderboard();

  const [previousEntries, setPreviousEntries] = useState(entries);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle animations when data updates
  useEffect(() => {
    if (entries.length > 0 && previousEntries.length > 0 && entries !== previousEntries) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 3000);
    }
    setPreviousEntries(entries);
  }, [entries, previousEntries]);

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
            onClick={refreshData}
            className="btn btn-primary flex items-center gap-2"
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
                onClick={refreshData}
                disabled={isLoading}
                className="btn btn-outline flex items-center gap-2"
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
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent"
            />
          </div>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="animate-spin text-primary-600 dark:text-primary-400 mx-auto mb-4" size={32} />
              <p className="text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'main' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Top 200 Players
                  </h2>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredEntries.length} players
                  </span>
                </div>

                {filteredEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchQuery ? 'No players found matching your search.' : 'No players found.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEntries.map((entry, index) => (
                      <LeaderboardEntryComponent
                        key={`${entry.username}-${entry.rank_position}`}
                        entry={entry}
                        index={index}
                        previousEntry={previousEntries.find(e => e.username === entry.username)}
                        isAnimating={isAnimating}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'gainers' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatsCard
                  stats={hottestGainers}
                  type="gainers"
                  title="Hottest Gainers"
                  icon={<TrendingUp size={24} />}
                />
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    About Hottest Gainers
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    These players have gained the most RP in the last 2 days. 
                    Click on any player to view their full profile and track their progress.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'losers' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatsCard
                  stats={biggestLosers}
                  type="losers"
                  title="Biggest Losers"
                  icon={<TrendingDown size={24} />}
                />
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    About Biggest Losers
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    These players have lost the most RP in the last 2 days. 
                    Click on any player to view their full profile and track their progress.
                  </p>
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