import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, Trophy, Clock, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { TabType } from '../types/leaderboard';
import LeaderboardEntryComponent from '../components/leaderboard/LeaderboardEntry';
import StatsCard from '../components/leaderboard/StatsCard';
import { TestLeaderboardData } from '../components/TestLeaderboardData';
import { robloxApi } from '../services/robloxApi';
import { lookupRobloxUserIds } from '../lib/robloxUserLookup';
import { supabase } from '../lib/supabase';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { AnimatePresence, motion } from 'framer-motion';
import { getRecentRPChanges, getCurrentlyRankingPlayers } from '../services/leaderboardService';

// Move these helpers to the top of the file:
const getDisplayPercentage = (player: any) => {
  // Use pre-computed percentage from leaderboard_insights
  if (player.category === 'gainer_new') {
    return "New Player joins LB";
  }
  if (player.percentage_change !== null && player.percentage_change !== undefined) {
    const percentage = player.percentage_change;
    return `${percentage > 0 ? '+' : ''}${percentage}%`;
  }
  return "0%";
};

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
    isLoadingLosers,
    filteredEntries,
    lastInsightsUpdate
  } = useLeaderboard();

  const [showTest, setShowTest] = useState(false); // Disable test component
  const [isRefreshingInsights, setIsRefreshingInsights] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showRealtimeToast, setShowRealtimeToast] = useState(false);
  const [recentRPChanges, setRecentRPChanges] = useState<Record<string, import('../services/leaderboardService').RPChangeData>>({});

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Direct database refresh function as fallback
  const refreshInsightsDirectly = async () => {
    try {
      console.log('🔄 Attempting direct database refresh...');
      
      // Clear existing insights data
      const { error: clearError } = await supabase
        .from('leaderboard_insights')
        .delete()
        .neq('id', 0); // Delete all records
      
      if (clearError) {
        console.error('❌ Error clearing insights:', clearError);
        setNotification({ message: '❌ Error clearing old insights data', type: 'error' });
        return;
      }
      
      // Insert fresh data from rp_changes_optimized
      const { data: changes, error: fetchError } = await supabase
        .from('rp_changes_optimized')
        .select('*')
        .order('change_timestamp', { ascending: false });
      
      if (fetchError) {
        console.error('❌ Error fetching rp_changes_optimized:', fetchError);
        setNotification({ message: '❌ Error fetching source data', type: 'error' });
        return;
      }
      
      // Process and insert insights
      const insights = changes?.map(change => ({
        username: change.username,
        rp_change: change.rp_change,
        change_timestamp: change.change_timestamp,
        category: change.rp_change > 0 ? 'gainer_established' : 'loser_ranked',
        transition_display: `${change.previous_calculated_rank} (${change.previous_rp} RP) → ${change.new_calculated_rank} (${change.new_rp} RP)`,
        percentage_change: change.previous_rp > 0 ? Math.round((change.rp_change / change.previous_rp) * 100 * 10) / 10 : 0
      })) || [];
      
      if (insights.length > 0) {
        const { error: insertError } = await supabase
          .from('leaderboard_insights')
          .insert(insights);
        
        if (insertError) {
          console.error('❌ Error inserting insights:', insertError);
          setNotification({ message: '❌ Error inserting new insights data', type: 'error' });
          return;
        }
      }
      
      console.log('✅ Direct refresh completed:', insights.length, 'records');
      setNotification({ message: `✅ Direct refresh completed: ${insights.length} records`, type: 'success' });
      refresh(); // Refresh the UI
      
    } catch (error) {
      console.error('❌ Error in direct refresh:', error);
      setNotification({ message: '❌ Error in direct refresh process', type: 'error' });
    }
  };

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

  const tabs: { id: TabType | 'currently-ranking'; label: string; icon: React.ReactNode }[] = [
    { id: 'main', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'gainers', label: 'Hottest Gainers', icon: <TrendingUp size={20} /> },
    { id: 'losers', label: 'Biggest Losers', icon: <TrendingDown size={20} /> },
    { id: 'currently-ranking', label: 'Currently Ranking', icon: <Clock size={20} /> }
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

  // --- Avatar enrichment for gainers/losers ---
  const [enrichedGainers, setEnrichedGainers] = useState<any[]>(gainers);
  const [enrichedLosers, setEnrichedLosers] = useState<any[]>(losers);

  useEffect(() => {
    const enrich = async (players: any[], setPlayers: (arr: any[]) => void) => {
      const toLookup = players.filter(p => !p.user_id);
      const usernames = toLookup.map(p => p.username);
      const lookupResults = await lookupRobloxUserIds(usernames);
      const lookupMap = new Map(
        lookupResults.map(r => [r.username.toLowerCase(), r])
      );
      const userIdsToFetch: number[] = [];
      const enriched = players.map(p => {
        const found = lookupMap.get(p.username.toLowerCase());
        let user_id = found?.user_id ?? p.user_id;
        if (typeof user_id === 'string' && !isNaN(Number(user_id))) user_id = Number(user_id);
        // Always set profile_picture from lookup result if present
        let profile_picture = (found && (found as any).profile_picture_url) ? (found as any).profile_picture_url : p.profile_picture || null;
        if (!profile_picture && user_id) userIdsToFetch.push(user_id);
        return {
          ...p,
          user_id,
          profile_picture
        };
      });
      let pictureMap = new Map<number, string>();
      if (userIdsToFetch.length > 0) {
        pictureMap = await robloxApi.getProfilePicturesBatch(userIdsToFetch);
      }
      const fullyEnriched = enriched.map(p => {
        if (p.profile_picture) return p;
        if (p.user_id && pictureMap.has(p.user_id)) {
          return { ...p, profile_picture: pictureMap.get(p.user_id) };
        }
        return p;
      });
      setPlayers(fullyEnriched);
    };
    enrich(gainers, setEnrichedGainers);
  }, [gainers]);

  useEffect(() => {
    const enrich = async (players: any[], setPlayers: (arr: any[]) => void) => {
      const toLookup = players.filter(p => !p.user_id);
      const usernames = toLookup.map(p => p.username);
      const lookupResults = await lookupRobloxUserIds(usernames);
      const lookupMap = new Map(
        lookupResults.map(r => [r.username.toLowerCase(), r])
      );
      const userIdsToFetch: number[] = [];
      const enriched = players.map(p => {
        const found = lookupMap.get(p.username.toLowerCase());
        let user_id = found?.user_id ?? p.user_id;
        if (typeof user_id === 'string' && !isNaN(Number(user_id))) user_id = Number(user_id);
        let profile_picture = (found && (found as any).profile_picture_url) ? (found as any).profile_picture_url : p.profile_picture || null;
        if (!profile_picture && user_id) userIdsToFetch.push(user_id);
        return {
          ...p,
          user_id,
          profile_picture
        };
      });
      let pictureMap = new Map<number, string>();
      if (userIdsToFetch.length > 0) {
        pictureMap = await robloxApi.getProfilePicturesBatch(userIdsToFetch);
      }
      const fullyEnriched = enriched.map(p => {
        if (p.profile_picture) return p;
        if (p.user_id && pictureMap.has(p.user_id)) {
          return { ...p, profile_picture: pictureMap.get(p.user_id) };
        }
        return p;
      });
      setPlayers(fullyEnriched);
    };
    enrich(losers, setEnrichedLosers);
  }, [losers]);

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

  // --- Sectioning and Transition Helpers ---
  const categorizeGainer = (player: any) => {
    // Use the pre-computed category from leaderboard_insights
    return player.category === 'gainer_new' ? 'new' : 'established';
  };
  
  const categorizeLoser = (player: any) => {
    // Use the pre-computed category from leaderboard_insights
    return player.category === 'loser_dropped' ? 'dropped' : 'established';
  };
  
  const getTransitionText = (player: any, isGainer: boolean) => {
    // Use the pre-computed transition_display from leaderboard_insights
    return player.transition_display || 'Unknown transition';
  };

  // --- Modern Gainers Section ---
  const renderGainersSection = () => {
    console.log('[renderGainersSection] enrichedGainers:', enrichedGainers);
    
    // Filter players based on search query
    const filteredGainers = searchQuery 
      ? enrichedGainers.filter(player => 
          player.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : enrichedGainers;
    
    const newPlayers = filteredGainers.filter(categorizeGainer).filter(p => categorizeGainer(p) === 'new');
    const establishedPlayers = filteredGainers.filter(categorizeGainer).filter(p => categorizeGainer(p) === 'established');
    return (
      <div className="space-y-6">
        {/* Established Players */}
        {establishedPlayers.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                📈 Established Players
              </h3>
              <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full text-xs font-medium">
                {searchQuery ? `${establishedPlayers.length} found` : `${establishedPlayers.length} active`}
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 scrollable-section shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="space-y-3 p-3">
                <TransitionGroup className="space-y-3">
                  {establishedPlayers.map((player, index) => (
                    <CSSTransition key={player.username} timeout={300} classNames="fade-slide">
                      <ModernGainerBar
                        player={{ ...player, getTransitionText: () => getTransitionText(player, true) }}
                        rank={index + 1}
                        isNewPlayer={false}
                      />
                    </CSSTransition>
                  ))}
                </TransitionGroup>
              </div>
            </div>
            {establishedPlayers.length > 6 && (
              <div className="text-center mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  Showing 6 of {establishedPlayers.length} players
                </span>
              </div>
            )}
          </div>
        )}
        {/* New to Leaderboard */}
        {newPlayers.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                🆕 New to Leaderboard
              </h3>
              <div className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full text-xs font-medium">
                {searchQuery ? `${newPlayers.length} found` : `${newPlayers.length} fresh`}
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 scrollable-section shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="space-y-3 p-3">
                <TransitionGroup className="space-y-3">
                  {newPlayers.map((player, index) => (
                    <CSSTransition key={player.username} timeout={300} classNames="fade-slide">
                      <ModernGainerBar
                        player={{ ...player, getTransitionText: () => getTransitionText(player, true) }}
                        rank={establishedPlayers.length + index + 1}
                        isNewPlayer={true}
                      />
                    </CSSTransition>
                  ))}
                </TransitionGroup>
              </div>
            </div>
            {newPlayers.length > 6 && (
              <div className="text-center mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  Showing 6 of {newPlayers.length} players
                </span>
              </div>
            )}
          </div>
        )}
        {establishedPlayers.length === 0 && newPlayers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchQuery 
              ? `No gainers found matching "${searchQuery}"` 
              : 'No RP gainers found in recent activity.'
            }
          </div>
        )}
      </div>
    );
  };

  // --- Modern Losers Section ---
  const renderLosersSection = () => {
    console.log('[renderLosersSection] enrichedLosers:', enrichedLosers);
    
    // Filter players based on search query
    const filteredLosers = searchQuery 
      ? enrichedLosers.filter(player => 
          player.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : enrichedLosers;
    
    const droppedPlayers = filteredLosers.filter(categorizeLoser).filter(p => categorizeLoser(p) === 'dropped');
    const establishedLosers = filteredLosers.filter(categorizeLoser).filter(p => categorizeLoser(p) === 'established');
    return (
      <div className="space-y-6">
        {/* Established Players */}
        {establishedLosers.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-red-400 to-pink-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                📉 Established Players
              </h3>
              <div className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full text-xs font-medium">
                {searchQuery ? `${establishedLosers.length} found` : `${establishedLosers.length} active`}
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 scrollable-section shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="space-y-3 p-3">
                <TransitionGroup className="space-y-3">
                  {establishedLosers.map((player, index) => (
                    <CSSTransition key={player.username} timeout={300} classNames="fade-slide">
                      <ModernLoserBar
                        player={{ ...player, getTransitionText: () => getTransitionText(player, false) }}
                        rank={index + 1}
                      />
                    </CSSTransition>
                  ))}
                </TransitionGroup>
              </div>
            </div>
            {establishedLosers.length > 6 && (
              <div className="text-center mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  Showing 6 of {establishedLosers.length} players
                </span>
              </div>
            )}
          </div>
        )}
        {/* Dropped from Top 200 */}
        {droppedPlayers.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-orange-400 to-red-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                🚫 Dropped from Top 200
              </h3>
              <div className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded-full text-xs font-medium">
                {searchQuery ? `${droppedPlayers.length} found` : `${droppedPlayers.length} dropped`}
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 scrollable-section shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="space-y-3 p-3">
                <TransitionGroup className="space-y-3">
                  {droppedPlayers.map((player, index) => (
                    <CSSTransition key={player.username} timeout={300} classNames="fade-slide">
                      <ModernLoserBar
                        player={{ ...player, getTransitionText: () => getTransitionText(player, false) }}
                        rank={establishedLosers.length + index + 1}
                      />
                    </CSSTransition>
                  ))}
                </TransitionGroup>
              </div>
            </div>
            {droppedPlayers.length > 6 && (
              <div className="text-center mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  Showing 6 of {droppedPlayers.length} players
                </span>
              </div>
            )}
          </div>
        )}
        {establishedLosers.length === 0 && droppedPlayers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchQuery 
              ? `No losers found matching "${searchQuery}"` 
              : 'No RP losses found in recent activity.'
            }
          </div>
        )}
      </div>
    );
  };

  // --- Modern Gainer Bar ---
  const ModernGainerBar = ({ player, rank, isNewPlayer }: any) => {
    console.log('[ModernGainerBar] username:', player.username, 'profile_picture:', player.profile_picture);
    return (
      <div className={`
        group relative overflow-hidden rounded-lg border transition-all duration-300 cursor-pointer animate-fade-in
        ${isNewPlayer 
          ? 'bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-blue-500/10 border-emerald-200/30 hover:border-emerald-300/60 border-l-4 border-l-emerald-500' 
          : 'bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-200/30 hover:border-green-300/60 border-l-4 border-l-green-500'
        }
        hover:shadow-lg hover:shadow-green-500/10 hover:scale-[1.01] hover:-translate-y-0.5
        backdrop-blur-sm
      `}>
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full blur-2xl"></div>
        </div>
        <div className="relative z-10 p-4">
          <div className="flex items-center justify-between">
            {/* Left Side - Rank, Avatar, and Username */}
            <div className="flex items-center space-x-4">
              {/* Ranking Number (outside the circle) */}
              <div className="flex flex-col items-center justify-center min-w-[32px]">
                <span className="text-xl font-extrabold text-gray-700 dark:text-gray-200 drop-shadow-sm">{rank}</span>
              </div>
              {/* Profile Picture in colored circle */}
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent border-4 border-green-400 shadow-md">
                {player.profile_picture ? (
                  <img
                    src={player.profile_picture}
                    alt={`${player.username}'s profile`}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={e => (e.currentTarget.src = '/default-avatar.svg')}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-bold">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* Username and Rank Transition */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors truncate">
                  {player.username}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {player.getTransitionText ? player.getTransitionText() : player.transition_display || 'Unknown transition'}
                </div>
              </div>
            </div>
            {/* Right Side - RP Gain and Percentage */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className={`
                px-4 py-2 rounded-full text-sm font-bold shadow-md
                ${isNewPlayer 
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                }
              `}>
                +{(player.rp_change || 0).toLocaleString()} RP
              </div>
              {/* Percentage or Label */}
              <div className={`
                text-xs px-3 py-1.5 rounded-full font-medium
                ${isNewPlayer 
                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' 
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }
              `}>
                {getDisplayPercentage(player)}
              </div>
              {/* Trending Arrow */}
              <div className="text-green-500 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Modern Loser Bar ---
  const ModernLoserBar = ({ player, rank }: any) => {
    console.log('[ModernLoserBar] username:', player.username, 'profile_picture:', player.profile_picture);
    return (
      <div className="group relative overflow-hidden rounded-lg border transition-all duration-300 cursor-pointer animate-fade-in bg-gradient-to-r from-red-500/10 via-orange-500/5 to-pink-500/10 border-red-200/30 hover:border-red-300/60 hover:shadow-lg hover:shadow-red-500/10 hover:scale-[1.01] hover:-translate-y-0.5 backdrop-blur-sm border-l-4 border-l-red-500">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400 to-pink-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-orange-400 to-red-500 rounded-full blur-2xl"></div>
        </div>
        <div className="relative z-10 p-4">
          <div className="flex items-center justify-between">
            {/* Left Side - Rank, Avatar, and Username */}
            <div className="flex items-center space-x-4">
              {/* Ranking Number (outside the circle) */}
              <div className="flex flex-col items-center justify-center min-w-[32px]">
                <span className="text-xl font-extrabold text-gray-700 dark:text-gray-200 drop-shadow-sm">{rank}</span>
              </div>
              {/* Profile Picture in colored circle */}
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent border-4 border-red-400 shadow-md">
                {player.profile_picture ? (
                  <img
                    src={player.profile_picture}
                    alt={`${player.username}'s profile`}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={e => (e.currentTarget.src = '/default-avatar.svg')}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-bold">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* Username and Rank Transition */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">
                  {player.username}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {player.getTransitionText ? player.getTransitionText() : player.transition_display || 'Unknown transition'}
                </div>
              </div>
            </div>
            {/* Right Side - RP Loss and Percentage */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="px-4 py-2 rounded-full text-sm font-bold shadow-md bg-gradient-to-r from-red-500 to-orange-500 text-white">
                {(player.rp_change || 0).toLocaleString()} RP
              </div>
              {/* Percentage or Label */}
              <div className="text-xs px-3 py-1.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {getDisplayPercentage(player)}
              </div>
              {/* Trending Arrow */}
              <div className="text-red-500 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add a toast for real-time updates
  useEffect(() => {
    const subscription = supabase
      .channel('leaderboard_refresh')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leaderboard_refresh_trigger'
      }, (payload) => {
        console.log('Lua script completed, refreshing leaderboard...');
        refresh(); // Use the existing refresh function
        setShowRealtimeToast(true);
        setTimeout(() => setShowRealtimeToast(false), 3000);
      })
      .subscribe();
    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  // Improved skeleton loader for gainers/losers
  const SkeletonLoader = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-center space-x-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
          </div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );

  // Fetch recent RP changes when entries change
  useEffect(() => {
    if (!filteredEntries || filteredEntries.length === 0) return;
    const usernames = filteredEntries.map(e => e.username);
    getRecentRPChanges(usernames).then(setRecentRPChanges);
  }, [filteredEntries]);

  // --- Currently Ranking State ---
  const [currentlyRanking, setCurrentlyRanking] = useState<any[]>([]);
  const [isLoadingCurrentlyRanking, setIsLoadingCurrentlyRanking] = useState(false);

  useEffect(() => {
    if (activeTab === 'currently-ranking') {
      setIsLoadingCurrentlyRanking(true);
      getCurrentlyRankingPlayers().then(players => {
        setCurrentlyRanking(players);
        setIsLoadingCurrentlyRanking(false);
      });
    }
  }, [activeTab, lastUpdate]);

  // --- Render Currently Ranking Section ---
  const renderCurrentlyRankingSection = () => {
    if (isLoadingCurrentlyRanking) {
      return <div className="h-64 flex items-center justify-center text-gray-400">Loading currently ranking players...</div>;
    }
    if (!currentlyRanking || currentlyRanking.length === 0) {
      return <div className="h-64 flex items-center justify-center text-gray-400">No players are currently ranking.</div>;
    }
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Clock size={22} className="text-blue-500 dark:text-blue-400" />
          Currently Ranking
          <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">({currentlyRanking.length} players)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {currentlyRanking.map((entry, idx) => (
            <div
              key={entry.username}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 flex flex-col items-center group transition hover:shadow-2xl border border-gray-200/60 dark:border-gray-700/60 hover:border-blue-400"
            >
              <div className="relative mb-3">
                <img
                  src={entry.profile_picture || '/default-avatar.svg'}
                  alt={entry.username + ' avatar'}
                  className="w-16 h-16 rounded-full object-cover border-4 border-blue-200 dark:border-blue-900 shadow"
                  onError={e => (e.currentTarget.src = '/default-avatar.svg')}
                  loading="lazy"
                />
                <span className="absolute -bottom-2 -right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full shadow font-semibold">
                  #{entry.rank_position}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-semibold text-lg text-gray-900 dark:text-white truncate max-w-[120px]">{entry.username}</span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 mb-1">
                  <img src={(() => {
                    const tier: string = (entry.rank_title?.split(' ')[0]?.toUpperCase() ?? 'BRONZE');
                    const urls: Record<string, string> = {
                      'BRONZE': 'https://static.wikia.nocookie.net/robloxbedwars/images/5/5a/Bronze_Rank_Icon.png',
                      'SILVER': 'https://static.wikia.nocookie.net/robloxbedwars/images/6/64/Silver_Rank_Icon.png',
                      'GOLD': 'https://static.wikia.nocookie.net/robloxbedwars/images/9/92/Gold_Rank_Icon.png',
                      'PLATINUM': 'https://static.wikia.nocookie.net/robloxbedwars/images/0/08/Platinum_Rank_Icon.png',
                      'DIAMOND': 'https://static.wikia.nocookie.net/robloxbedwars/images/c/cb/Diamond_Rank_Icon.png',
                      'EMERALD': 'https://static.wikia.nocookie.net/robloxbedwars/images/0/06/Emerald_Rank_Icon.png',
                      'NIGHTMARE': 'https://static.wikia.nocookie.net/robloxbedwars/images/7/76/Nightmare_Rank_Icon.png',
                    };
                    return urls[tier as keyof typeof urls] || urls['BRONZE'];
                  })()} alt="rank icon" className="w-5 h-5 mr-1 inline-block" />
                  {entry.rank_title}
                </span>
                <span className="text-blue-600 dark:text-blue-300 font-bold text-base">{entry.rp} RP</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last active: {entry.last_active ? formatLastUpdate(entry.last_active) : '—'}</span>
              </div>
              {entry.user_id && (
                <a
                  href={`https://www.roblox.com/users/${entry.user_id}/profile`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Roblox Profile
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Tab Content Switch ---
  let tabContent;
  if (activeTab === 'main') {
    tabContent = (
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
          <div className="flex flex-col gap-3 w-full">
            {filteredEntries.map((entry: import('../types/leaderboard').LeaderboardEntryWithChanges) => (
              <LeaderboardEntryComponent
                key={entry.username}
                entry={entry}
                index={entry.rank_position - 1}
                recentChange={recentRPChanges[entry.username]}
              />
            ))}
          </div>
        )}
      </div>
    );
  } else if (activeTab === 'gainers' || activeTab === 'losers') {
    tabContent = (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {activeTab === 'gainers' ? '🔥 Hottest Gainers' : '📉 Biggest Losers'}
              {searchQuery && (
                <span className="ml-3 text-sm font-normal text-blue-600 dark:text-blue-400">
                  (Searching: "{searchQuery}")
                </span>
              )}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {activeTab === 'gainers' ? 'Players with the biggest RP gains' : 'Players with the biggest RP losses'}
              {searchQuery && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  • Filtered results
                </span>
              )}
            </p>
          </div>
          {/* Modern Segmented Control for Time Filter */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {['6h', '12h', '1d', '2d'].map(opt => (
              <button
                key={opt}
                type="button"
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  ((activeTab === 'gainers' ? gainersTimeRange : losersTimeRange) === opt) 
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                onClick={() => {
                  activeTab === 'gainers' ? setGainersTimeRange(opt as any) : setLosersTimeRange(opt as any);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        {(activeTab === 'gainers' ? isLoadingGainers : isLoadingLosers) ? (
          <SkeletonLoader />
        ) : (
          activeTab === 'gainers' ? renderGainersSection() : renderLosersSection()
        )}
        {(activeTab === 'gainers' || activeTab === 'losers') && lastInsightsUpdate && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-right">
            Insights last updated: {formatLastUpdate(lastInsightsUpdate)}
          </div>
        )}
      </div>
    );
  } else if (activeTab === 'currently-ranking') {
    tabContent = renderCurrentlyRankingSection();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full bg-[#232B39] dark:bg-gray-800 border-b border-gray-200/10 dark:border-gray-700/40 px-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-8 py-6 w-full">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-wide mb-1" style={{letterSpacing: '0.01em'}}>Leaderboard</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium">
                <Clock size={16} className="mr-1" />
                Last updated: {formatLastUpdate(lastUpdate)}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: isLive ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)' }}>
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-400'} inline-block`}></span>
                <span className={isLive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                  {isLive ? 'Online' : 'Offline'}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-end">
            <button
              onClick={refresh}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>

            {/* Hide Clear Avatar Cache button visually, but keep code for dev use */}
            {/* <button
              onClick={handleClearCache}
              className="ml-2 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-semibold text-xs shadow hover:bg-red-200 transition hidden"
              title="Clear Roblox avatar cache (debug)"
            >
              Clear Avatar Cache
            </button> */}

            <button
              onClick={async () => {
                if (isRefreshingInsights) return;
                setIsRefreshingInsights(true);
                try {
                  const { data, error } = await supabase.functions.invoke('populate-leaderboard-insights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: {},
                  });
                  if (error) {
                    setNotification({ message: `❌ Failed to refresh insights: ${error.message}`, type: 'error' });
                  } else {
                    refresh();
                    setNotification({ message: '✅ Leaderboard insights refreshed successfully!', type: 'success' });
                  }
                } catch (error) {
                  setNotification({ message: '❌ Error calling populate-leaderboard-insights.', type: 'error' });
                } finally {
                  setIsRefreshingInsights(false);
                }
              }}
              disabled={isRefreshingInsights}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${isRefreshingInsights ? 'opacity-60 cursor-not-allowed' : ''}`}
              title="Manually trigger the populate-leaderboard-insights edge function to refresh gainers/losers data from rp_changes_optimized"
            >
              {isRefreshingInsights ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />} Refresh Insights
            </button>
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
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="w-full"
              >
                {tabContent}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
      {showRealtimeToast && (
        <div className="fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg bg-blue-100 text-blue-800 border border-blue-200 transition-all duration-300">
          <span className="font-medium">Leaderboard insights just updated!</span>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;

/*
.fade-slide-enter {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms, transform 300ms;
}
.fade-slide-exit {
  opacity: 1;
  transform: translateY(0);
}
.fade-slide-exit-active {
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 300ms, transform 300ms;
}
*/ 