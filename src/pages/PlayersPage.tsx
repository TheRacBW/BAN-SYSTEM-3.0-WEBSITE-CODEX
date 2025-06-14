import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Player, SortOption, RANK_VALUES } from '../types/players';
import { Plus, Search, Users, Gamepad2, ArrowUpDown, RefreshCw } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';

export default function PlayersPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showInBedwarsOnly, setShowInBedwarsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('alias_asc');
  const [newYoutubeChannel, setNewYoutubeChannel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterOnline, setFilterOnline] = useState(false);
  const [filterInGame, setFilterInGame] = useState(false);
  const [filterInBedwars, setFilterInBedwars] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

  useEffect(() => {
    if (user) {
      fetchPlayers();
    }
  }, [user]);

  const fetchAccountStatuses = async (playersList: Player[]) => {
    try {
      console.log('Fetching statuses for players:', playersList.length);
      const updatedPlayers = await Promise.all(
        playersList.map(async player => {
          console.log('Fetching statuses for player:', player.alias);
          const updatedAccounts = await Promise.all(
            (player.accounts || []).map(async acc => {
              try {
                console.log('Fetching status for account:', acc.user_id);
                const { data, error } = await supabase.functions.invoke('roblox-status', {
                  body: { userId: acc.user_id }
                });
                if (!error && data) {
                  console.log('Status response for account:', acc.user_id, data);
                  const resp: any = data;
                  return {
                    ...acc,
                    status: {
                      isOnline: resp.isOnline,
                      isInGame: resp.isInGame ?? false,
                      inBedwars: typeof resp.inBedwars === 'boolean'
                        ? resp.inBedwars
                        : (resp.isInGame ?? false) && (
                            Number(resp.placeId) === BEDWARS_PLACE_ID ||
                            Number(resp.rootPlaceId) === BEDWARS_PLACE_ID ||
                            Number(resp.universeId) === BEDWARS_UNIVERSE_ID
                          ),
                      userPresenceType: resp.userPresenceType,
                      placeId: resp.placeId,
                      rootPlaceId: resp.rootPlaceId,
                      universeId: resp.universeId,
                      presenceMethod: resp.presenceMethod,
                      username: resp.username,
                      lastUpdated: resp.lastUpdated,
                    },
                  };
                }
              } catch (err) {
                console.error('Status fetch error for account:', acc.user_id, err);
              }
              return acc;
            })
          );
          return { ...player, accounts: updatedAccounts };
        })
      );

      return updatedPlayers;
    } catch (error) {
      console.error('Error fetching statuses:', error);
      return playersList;
    }
  };

  const fetchPlayers = async () => {
    const timestamp = new Date().getTime();
    const response = await fetch(`/api/players?_t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    return response.json();
  };

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
      fetchPlayers();
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
      fetchPlayers();
    } catch (error) {
      console.error('Error deleting player:', error);
      setError('Failed to delete player');
    }
  };

  const getPlayerRankScore = (player: Player) => {
    if (!player.accounts?.length) return 0;
    
    const ranks = player.accounts
      .map(account => account.rank?.[0]?.account_ranks?.name)
      .filter(Boolean)
      .map(rankName => RANK_VALUES[rankName as keyof typeof RANK_VALUES] || 0);
    
    return ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;
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

    return matchesSearch && hasOnlineAccount && hasInBedwarsAccount;
  });

  const sortedPlayers = sortPlayers(filteredPlayers);

  const handleRefreshAll = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/roblox-status', { 
        method: 'POST',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update player statuses');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const data = await fetchPlayers();
      setPlayers(data);
      
    } catch (error) {
      console.error('Refresh failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh player data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-lg text-gray-600">Please log in to view players</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Players</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
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
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlayers.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            isAdmin={isAdmin}
            onDelete={handleDeletePlayer}
          />
        ))}
      </div>

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
    </div>
  );
}