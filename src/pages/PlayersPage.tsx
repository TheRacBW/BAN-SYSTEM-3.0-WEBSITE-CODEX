import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Player, SortOption, RANK_VALUES } from '../types/players';
import { Plus, Search, Users, Gamepad2, ArrowUpDown, RefreshCw, Pin, X } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';
import { useUserPins } from '../hooks/useUserPins';
import RobloxStatus from '../components/RobloxStatus';
import { VerificationGuard } from '../components/auth';
import { FrontendActivityTracker } from '../services/activityTracker';

// Shared refresh hook for coordinated player tracking refresh
function useSharedPlayerRefresh(user: any) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const tabVisibleRef = useRef(true);

  // Listen for tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      tabVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Load players from database only (no edge function call)
  const loadPlayersFromDatabase = async () => {
    console.log('🔄 loadPlayersFromDatabase: Starting...');
    setIsRefreshing(true); // Indicate refresh is in progress
    try {
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          *,
          accounts:player_accounts(
            id,
            user_id,
            rank:player_account_ranks(
              rank_id,
              account_ranks(*)
            )
          ),
          teammates:player_teammates!player_id(
            teammate:players!teammate_id(*)
          ),
          strategies:player_strategies(
            id,
            image_url,
            kit_ids,
            teammate_ids,
            starred_kit_id,
            created_at
          )
        `)
        .order('alias');

      if (playersError) {
        console.error('❌ loadPlayersFromDatabase: Database error:', playersError);
        throw playersError;
      }

      console.log('✅ loadPlayersFromDatabase: Successfully fetched players:', playersData?.length || 0);

      if (playersData) {
        // Fetch statuses for all accounts
        console.log('🔄 loadPlayersFromDatabase: Calling fetchAccountStatuses...');
        const playersWithStatuses = await fetchAccountStatuses(playersData);
        console.log('✅ loadPlayersFromDatabase: Players with statuses:', playersWithStatuses.length);
        
        // Update state with the new data
        setPlayers(playersWithStatuses);
        
        // Set lastRefresh to current time
        setLastRefresh(new Date());
      } else {
        console.log('⚠️ loadPlayersFromDatabase: No playersData received, setting empty array');
        setPlayers([]);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('❌ loadPlayersFromDatabase: Error loading players:', error);
      setLastRefresh(null); // Clear last refresh on error
    } finally {
      console.log('🏁 loadPlayersFromDatabase: Setting isRefreshing to false');
      setIsRefreshing(false);
    }
  };

  // Fetch statuses for all accounts
  const fetchAccountStatuses = async (playersList: Player[]) => {
    try {
      console.log('🚀 fetchAccountStatuses: Starting with players:', playersList.length);
      
      // Read the status data from the roblox_user_status table
      console.log('📖 fetchAccountStatuses: Reading status data from roblox_user_status table...');
      const { data: statusData, error: statusError } = await supabase
        .from('roblox_user_status')
        .select('*');
      
      if (statusError) {
        console.error('❌ fetchAccountStatuses: Error reading from roblox_user_status table:', statusError);
        return playersList;
      }
      
      if (!statusData || !Array.isArray(statusData)) {
        console.error('❌ fetchAccountStatuses: Invalid status data from database:', statusData);
        return playersList;
      }
      
      console.log('✅ fetchAccountStatuses: Successfully read status data:', statusData.length, 'records');
      console.log('📊 fetchAccountStatuses: Sample status data:', statusData[0]);
      
      // Create a map of user_id to status for quick lookup
      const statusMap = new Map();
      statusData.forEach((status: any) => {
        statusMap.set(status.user_id, status);
      });
      
      console.log('🗺️ fetchAccountStatuses: Created status map with', statusMap.size, 'entries');
      
      // Update players with their account statuses and activity tracking
      const updatedPlayers = await Promise.all(
        playersList.map(async player => {
          const updatedAccounts = await Promise.all(
            (player.accounts || []).map(async acc => {
              const status = statusMap.get(acc.user_id);
              if (status) {
                console.log('✅ fetchAccountStatuses: Found status for account:', acc.user_id, status);
                
                // Get current Roblox status
                const currentStatus = {
                  userId: acc.user_id.toString(),
                  username: status.username,
                  isOnline: status.is_online || false,
                  isInGame: status.is_in_game || false,
                  inBedwars: status.in_bedwars || false,
                  placeId: status.place_id,
                  universeId: status.universe_id,
                  lastUpdated: new Date(status.last_updated).getTime()
                };
                
                // Get previous status from database
                const previousStatus = await FrontendActivityTracker.getCurrentStatus(acc.user_id.toString());
                
                // Track the status change in database
                await FrontendActivityTracker.trackStatusChange(
                  acc.user_id.toString(), 
                  currentStatus, 
                  previousStatus
                );
                
                // Get enhanced activity data
                const activityData = await FrontendActivityTracker.getActivityData(acc.user_id.toString());
                
                // Determine last seen status
                let lastSeenStatus = 'offline';
                if (status.in_bedwars) {
                  lastSeenStatus = 'in_bedwars';
                } else if (status.is_in_game) {
                  lastSeenStatus = 'in_game';
                } else if (status.is_online) {
                  lastSeenStatus = 'online';
                }
                
                return {
                  ...acc,
                  status: {
                    isOnline: status.is_online,
                    isInGame: status.is_in_game ?? false,
                    inBedwars: typeof status.in_bedwars === 'boolean'
                      ? status.in_bedwars
                      : (status.is_in_game ?? false) && (
                          Number(status.place_id) === BEDWARS_PLACE_ID ||
                          Number(status.root_place_id) === BEDWARS_PLACE_ID ||
                          Number(status.universe_id) === BEDWARS_UNIVERSE_ID
                        ),
                    userPresenceType: status.user_presence_type,
                    placeId: status.place_id,
                    rootPlaceId: status.root_place_id,
                    universeId: status.universe_id,
                    presenceMethod: status.presence_method,
                    username: status.username,
                    lastUpdated: new Date(status.last_updated).getTime(),
                    // Activity Pulse Data from database
                    dailyMinutesToday: activityData?.daily_minutes_today || 0,
                    weeklyAverage: activityData?.weekly_average || 0,
                    activityTrend: activityData?.activity_trend || 'stable',
                    preferredTimePeriod: activityData?.preferred_time_period || 'unknown',
                    currentSessionMinutes: activityData?.current_session_minutes || 0,
                    isCurrentlyOnline: activityData?.is_online || false,
                    // Last seen information
                    lastSeenAccount: status.username,
                    lastSeenStatus: lastSeenStatus
                  },
                };
              } else {
                console.log('⚠️ fetchAccountStatuses: No status found for account:', acc.user_id);
              }
              return acc;
            })
          );
          
          return { ...player, accounts: updatedAccounts };
        })
      );

      console.log('✅ fetchAccountStatuses: Returning updated players:', updatedPlayers.length);
      return updatedPlayers;
    } catch (error) {
      console.error('❌ fetchAccountStatuses: Error fetching statuses:', error);
      return playersList;
    }
  };

  // Check if refresh is needed
  const shouldRefresh = async () => {
    const { data } = await supabase
      .from('player_tracking_refresh')
      .select('last_refresh_at, status')
      .eq('id', 1)
      .single();
    if (!data) return true; // No refresh table, assume needs refresh
    const lastRefreshTime = new Date(data.last_refresh_at);
    const timeSinceRefresh = Date.now() - lastRefreshTime.getTime();
    return timeSinceRefresh > 25000 || data.status !== 'running'; // 25s or not running
  };

  // Smart refresh function
  const refreshIfNeeded = async () => {
    if (isRefreshing) return;
    const needsRefresh = await shouldRefresh();
    if (!needsRefresh) {
      await loadPlayersFromDatabase();
      return;
    }
    setIsRefreshing(true);
    try {
      await supabase
        .from('player_tracking_refresh')
        .update({ status: 'running', triggered_by: user?.id })
        .eq('id', 1);
      const result = await supabase.functions.invoke('roblox-status');
      if (result.error) throw result.error;
      await supabase
        .from('player_tracking_refresh')
        .update({ status: 'complete', last_refresh_at: new Date().toISOString() })
        .eq('id', 1);
      await loadPlayersFromDatabase();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Refresh failed:', error);
      await supabase
        .from('player_tracking_refresh')
        .update({ status: 'error' })
        .eq('id', 1);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Polling with coordination and tab visibility awareness
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const poll = () => {
      if (tabVisibleRef.current) {
        refreshIfNeeded();
      }
    };
    poll(); // Initial load
    interval = setInterval(poll, 30000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  return { players, isRefreshing, lastRefresh, refreshIfNeeded };
}

export default function PlayersPage() {
  const navigate = useNavigate();

  // Setup cleanup and rate limiting
  useEffect(() => {
    const setupCleanupAndLimiting = () => {
      // Clean up frontend rate limiting every hour
      const rateLimitCleanup = setInterval(() => {
        FrontendActivityTracker.cleanupRateLimiting();
      }, 60 * 60 * 1000);
      
      // Run database cleanup every 6 hours
      const databaseCleanup = setInterval(async () => {
        try {
          const { data, error } = await supabase.rpc('comprehensive_presence_cleanup');
          if (!error && data) {
            console.log('Database cleanup result:', data);
          }
        } catch (error) {
          console.error('Database cleanup failed:', error);
        }
      }, 6 * 60 * 60 * 1000);
      
      return () => {
        clearInterval(rateLimitCleanup);
        clearInterval(databaseCleanup);
      };
    };
    
    return setupCleanupAndLimiting();
  }, []);

  // Update the activity summary refresh to be less aggressive
  useEffect(() => {
    const refreshActivitySummaries = async () => {
      // Only refresh if someone is actually viewing the page
      if (document.hidden) return;
      
      try {
        const { data: activeUsers } = await supabase
          .from('roblox_user_status')
          .select('user_id')
          .eq('is_online', true)
          .limit(20); // Only process top 20 online users
        
        if (activeUsers && activeUsers.length > 0) {
          const userIds = activeUsers.map(u => u.user_id.toString());
          await FrontendActivityTracker.refreshMultipleActivitySummaries(userIds);
        }
      } catch (error) {
        console.error('Failed to refresh activity summaries:', error);
      }
    };
    
    // Reduced frequency: every 15 minutes instead of 10
    const interval = setInterval(refreshActivitySummaries, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const { user, isAdmin } = useAuth();
  const { pinnedPlayers, togglePin, isPinned, loading: pinsLoading } = useUserPins();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showInBedwarsOnly, setShowInBedwarsOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('alias_asc');
  const [newYoutubeChannel, setNewYoutubeChannel] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterOnline, setFilterOnline] = useState(false);
  const [filterInGame, setFilterInGame] = useState(false);
  const [filterInBedwars, setFilterInBedwars] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [selectedTeammate, setSelectedTeammate] = useState<Player | null>(null);
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Use the shared refresh system
  const { players, isRefreshing, lastRefresh, refreshIfNeeded } = useSharedPlayerRefresh(user);

  // Centralized data loading function that handles all state management
  const loadPlayers = async () => {
    console.log('🔄 loadPlayers: Starting centralized data load...');
    // setLoading(true); // This state is now managed by useSharedPlayerRefresh
    // setDataReady(false); // This state is now managed by useSharedPlayerRefresh
    setError(null);
    
    try {
      // Fetch players with their accounts and related data
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          *,
          accounts:player_accounts(
            id,
            user_id,
            rank:player_account_ranks(
              rank_id,
              account_ranks(*)
            )
          ),
          teammates:player_teammates!player_id(
            teammate:players!teammate_id(*)
          ),
          strategies:player_strategies(
            id,
            image_url,
            kit_ids,
            teammate_ids,
            starred_kit_id,
            created_at
          )
        `)
        .order('alias');

      if (playersError) {
        console.error('❌ loadPlayers: Database error:', playersError);
        throw playersError;
      }

      console.log('✅ loadPlayers: Successfully fetched players:', playersData?.length || 0);

      if (playersData) {
        // Fetch statuses for all accounts
        
        // Update state with the new data
        // setPlayers(playersWithStatuses); // This state is now managed by useSharedPlayerRefresh
        
        // Set dataReady to true if we have data (even if empty array)
        console.log('✅ loadPlayers: Setting dataReady to true - data loaded');
        // setDataReady(true); // This state is now managed by useSharedPlayerRefresh
      } else {
        console.log('⚠️ loadPlayers: No playersData received, setting empty array');
        // setPlayers([]); // This state is now managed by useSharedPlayerRefresh
        // setDataReady(true); // This state is now managed by useSharedPlayerRefresh
      }
    } catch (error) {
      console.error('❌ loadPlayers: Error loading players:', error);
      setError('Failed to load players');
      // setDataReady(false); // Don't show UI on error - now managed by useSharedPlayerRefresh
    } finally {
      console.log('🏁 loadPlayers: Setting loading to false');
      // setLoading(false); // This state is now managed by useSharedPlayerRefresh
    }
  };

  useEffect(() => {
    if (user) {
      console.log('🔍 PlayersPage: User authenticated, loading players...');
      loadPlayers();
    } else {
      console.log('🔍 PlayersPage: No user, skipping load');
    }
  }, [user]);

  const handleAddPlayer = async () => {
    if (!newAlias.trim()) {
      setError('Please enter an alias');
      return;
    }

    try {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          created_by: user?.id,
          alias: newAlias.trim(),
          youtube_channel: newYoutubeChannel.trim() || null
        })
        .select()
        .single();

      if (playerError) throw playerError;

      setSuccess('Player added successfully');
      setShowAddModal(false);
      setNewAlias('');
      setNewYoutubeChannel('');
      loadPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
      setError('Failed to add player');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      setSuccess('Player deleted successfully');
      loadPlayers();
    } catch (error) {
      console.error('Error deleting player:', error);
      setError('Failed to delete player');
    }
  };

  const getPlayerRankScore = (player: Player) => {
    const ranks = player.accounts
      ?.map((acc: any) => {
        // Handle array structure
        if (acc.rank && Array.isArray(acc.rank) && acc.rank.length > 0) {
          return acc.rank[0].account_ranks?.name;
        }
        return null;
      })
      .filter(Boolean)
      .map((rankName: string) => RANK_VALUES[rankName as keyof typeof RANK_VALUES] || 0);
    
    return ranks?.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;
  };

  const sortPlayers = (players: Player[]) => {
    return [...players].sort((a, b) => {
      switch (sortBy) {
        case 'alias_asc':
          return a.alias.localeCompare(b.alias);
        case 'alias_desc':
          return b.alias.localeCompare(a.alias);
        case 'online':
          const aOnline = a.accounts?.some(acc => acc.status?.isOnline) ? 1 : 0;
          const bOnline = b.accounts?.some(acc => acc.status?.isOnline) ? 1 : 0;
          return bOnline - aOnline;
        case 'rank':
          return getPlayerRankScore(b) - getPlayerRankScore(a);
        default:
          return 0;
      }
    });
  };

  const filteredPlayers = players.filter(player => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      player.alias.toLowerCase().includes(searchLower) ||
      player.accounts?.some(account => 
        account.status?.username?.toLowerCase().includes(searchLower)
      );

    const hasOnlineAccount = !showOnlineOnly || player.accounts?.some(account => 
      account.status?.isOnline
    );

    const hasInBedwarsAccount =
      !showInBedwarsOnly ||
      player.accounts?.some(account =>
        account.status?.inBedwars ||
        account.status?.placeId === BEDWARS_PLACE_ID ||
        account.status?.rootPlaceId === BEDWARS_PLACE_ID ||
        account.status?.universeId === BEDWARS_UNIVERSE_ID
      );

    const isPinnedPlayer = !showPinnedOnly || isPinned(player.id);

    return matchesSearch && hasOnlineAccount && hasInBedwarsAccount && isPinnedPlayer;
  });

  const sortedPlayers = sortPlayers(filteredPlayers);

  // Critical debug logging to track render state
  console.log('🎯 RENDER STATE:', { 
    // loading, // This state is now managed by useSharedPlayerRefresh
    // dataReady, // This state is now managed by useSharedPlayerRefresh
    playersCount: players.length,
    hasPlayers: players.length > 0,
    filteredPlayersCount: filteredPlayers.length,
    sortedPlayersCount: sortedPlayers.length,
    // shouldShowLoading: loading || !dataReady, // This state is now managed by useSharedPlayerRefresh
    renderCondition: isRefreshing ? 'SHOWING_REFRESHING' : 'SHOWING_CONTENT',
    timestamp: new Date().toISOString()
  });

  // For manual refresh (e.g. button):
  const handleRefreshAll = async () => {
    await refreshIfNeeded();
  };

  const handleNavigateToPlayer = (playerId: string) => {
    const targetPlayer = players.find(p => p.id === playerId);
    if (targetPlayer) {
      console.log(`Navigating to player: ${targetPlayer.alias}`);
      setModalPlayer(targetPlayer);
    } else {
      console.warn(`Could not find player with ID: ${playerId} to navigate to.`);
    }
  };

  // New targeted update function that only updates a specific player
  const handlePlayerUpdate = async (playerId: string) => {
    console.log('🔄 handlePlayerUpdate: Updating specific player:', playerId);
    
    try {
      // Fetch only the updated player data with all related information
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          *,
          accounts:player_accounts(
            id,
            user_id,
            rank:player_account_ranks(
              rank_id,
              account_ranks(*)
            )
          ),
          teammates:player_teammates!player_id(
            teammate:players!teammate_id(*)
          ),
          strategies:player_strategies(
            id,
            image_url,
            kit_ids,
            teammate_ids,
            starred_kit_id,
            created_at
          )
        `)
        .eq('id', playerId)
        .single();

      if (playerError) {
        console.error('❌ handlePlayerUpdate: Error fetching player data:', playerError);
        throw playerError;
      }

      if (playerData) {
        // Fetch status data for this player's accounts
        const accountUserIds = playerData.accounts?.map((acc: any) => acc.user_id) || [];
        
        if (accountUserIds.length > 0) {
          const { data: statusData, error: statusError } = await supabase
            .from('roblox_user_status')
            .select('*')
            .in('user_id', accountUserIds);

          if (!statusError && statusData) {
            const statusMap = new Map();
            statusData.forEach((status: any) => {
              statusMap.set(status.user_id, status);
            });

            // Update player's accounts with status data and activity tracking
            const updatedAccounts = await Promise.all(
              (playerData.accounts || []).map(async (acc: any) => {
                const status = statusMap.get(acc.user_id);
                if (status) {
                  // Get enhanced activity data from database
                  const activityData = await FrontendActivityTracker.getActivityData(acc.user_id.toString());
                  
                  return {
                    ...acc,
                    status: {
                      isOnline: status.is_online,
                      isInGame: status.is_in_game ?? false,
                      inBedwars: typeof status.in_bedwars === 'boolean'
                        ? status.in_bedwars
                        : (status.is_in_game ?? false) && (
                            Number(status.place_id) === BEDWARS_PLACE_ID ||
                            Number(status.root_place_id) === BEDWARS_PLACE_ID ||
                            Number(status.universe_id) === BEDWARS_UNIVERSE_ID
                          ),
                      userPresenceType: status.user_presence_type,
                      placeId: status.place_id,
                      rootPlaceId: status.root_place_id,
                      universeId: status.universe_id,
                      presenceMethod: status.presence_method,
                      username: status.username,
                      lastUpdated: new Date(status.last_updated).getTime(),
                      // Activity Pulse Data from database
                      dailyMinutesToday: activityData?.daily_minutes_today || 0,
                      weeklyAverage: activityData?.weekly_average || 0,
                      activityTrend: activityData?.activity_trend || 'stable',
                      preferredTimePeriod: activityData?.preferred_time_period || 'unknown',
                      currentSessionMinutes: activityData?.current_session_minutes || 0,
                      isCurrentlyOnline: activityData?.is_online || false
                    },
                  };
                }
                return acc;
              })
            );

            playerData.accounts = updatedAccounts;
          }
        }

        // Update only this player in the state
        // setPlayers(prevPlayers => 
        //   prevPlayers.map(p => 
        //     p.id === playerId ? playerData : p
        //   )
        // ); // This state is now managed by useSharedPlayerRefresh
        
        console.log('✅ handlePlayerUpdate: Player updated in state without page refresh');
      }
    } catch (error) {
      console.error('❌ handlePlayerUpdate: Error updating player:', error);
      // Fallback to full refresh only if targeted update fails
      console.log('�� handlePlayerUpdate: Falling back to full refresh');
      await loadPlayers();
    }
  };

  const handlePinToggle = async (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await togglePin(playerId);
  };

  const handleTeammateClick = (teammate: Player) => {
    console.log('Opening teammate modal for:', teammate.alias);
    setSelectedTeammate(teammate);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-lg text-gray-600">Please log in to view players</p>
      </div>
    );
  }

  // Only show full loading spinner on very first load
  if (isRefreshing && players.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show empty state if no players found
  if (players.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Players</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Player
          </button>
        </div>
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-4">No players found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
            >
              Add Your First Player
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VerificationGuard pagePath="/tracker">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {isRefreshing && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-blue-500/90 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8v8z" className="opacity-75" /></svg>
              Updating...
            </div>
          </div>
        )}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Players</h2>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh All
                </>
              )}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Add Player
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search players by alias or Roblox username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="alias_asc">Name (A-Z)</option>
                <option value="alias_desc">Name (Z-A)</option>
                <option value="online">Online Status</option>
                <option value="rank">Highest Rank</option>
              </select>

              <button
                onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                className={`btn ${
                  showOnlineOnly 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'btn-outline'
                } flex items-center gap-2`}
              >
                <Users size={18} />
                Online Only
              </button>

              <button
                onClick={() => setShowInBedwarsOnly(!showInBedwarsOnly)}
                className={`btn ${
                  showInBedwarsOnly 
                    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                    : 'btn-outline'
                } flex items-center gap-2`}
              >
                <Gamepad2 size={18} />
                In Bedwars
              </button>

              {user && (
                <button
                  onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                  className={`btn ${
                    showPinnedOnly 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                      : 'btn-outline'
                  } flex items-center gap-2`}
                >
                  <Pin size={18} />
                  Pinned Only
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPlayers.map(player => (
            <div key={player.id} onClick={() => setModalPlayer(player)}>
              <PlayerCard
                player={player}
                isAdmin={isAdmin}
                onDelete={handleDeletePlayer}
                isPinned={isPinned(player.id)}
                onPinToggle={handlePinToggle}
                showPinIcon={!!user}
                onPlayerUpdate={handlePlayerUpdate}
              />
            </div>
          ))}
        </div>

        {modalPlayer && (
          <PlayerCard
            key={modalPlayer.id}
            player={modalPlayer}
            isAdmin={isAdmin}
            onDelete={handleDeletePlayer}
            isPinned={isPinned(modalPlayer.id)}
            onPinToggle={handlePinToggle}
            showPinIcon={!!user}
            onPlayerUpdate={handlePlayerUpdate}
            onNavigateToPlayer={handleNavigateToPlayer}
            onClose={() => setModalPlayer(null)}
            isModal={true}
          />
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">Add New Player</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Player Alias
                  </label>
                  <input
                    type="text"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Enter player alias"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    YouTube Channel (Optional)
                  </label>
                  <input
                    type="text"
                    value={newYoutubeChannel}
                    onChange={(e) => setNewYoutubeChannel(e.target.value)}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Enter YouTube channel URL"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewAlias('');
                      setNewYoutubeChannel('');
                    }}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPlayer}
                    className="btn btn-primary"
                  >
                    Add Player
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Teammate Modal */}
        {selectedTeammate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedTeammate.alias}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Users size={18} className="text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Teammate of {players.find(p => p.id === selectedTeammate.id)?.alias || 'Unknown'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeammate(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="text-lg font-semibold mb-4">Known Accounts</h3>
                  <div className="space-y-4">
                    {selectedTeammate.accounts?.map(account => (
                      <div 
                        key={account.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <RobloxStatus 
                              username={account.status?.username || account.user_id.toString()}
                              isOnline={account.status?.isOnline || false}
                              isInGame={account.status?.isInGame || false}
                              inBedwars={account.status?.inBedwars || false}
                              lastUpdated={account.status?.lastUpdated}
                            />
                          </div>
                          {account.rank && Array.isArray(account.rank) && account.rank.length > 0 && (
                            <img
                              src={account.rank[0].account_ranks.image_url}
                              alt={account.rank[0].account_ranks.name}
                              className="w-8 h-8"
                              title={account.rank[0].account_ranks.name}
                            />
                          )}
                          {account.status?.inBedwars && (
                            <img
                              src="https://cdn2.steamgriddb.com/icon/3ad9ecf4b4a26b7671e09283f001d626.png"
                              alt="BedWars"
                              className="w-8 h-8"
                              title="In BedWars"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setSelectedTeammate(null)}
                    className="btn btn-outline"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </VerificationGuard>
  );
}