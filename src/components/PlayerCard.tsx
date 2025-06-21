import React, { useState, useEffect } from 'react';
import { Player, PlayerAccount, AccountRank } from '../types/players';
import { Kit } from '../types';
import { useAuth } from '../context/AuthContext';
import { useKits } from '../context/KitContext';
import { supabase } from '../lib/supabase';
import KitCard from './KitCard';
import RobloxStatus from './RobloxStatus';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';
import { 
  Edit2, 
  Trash2, 
  Plus, 
  Users, 
  Upload,
  HelpCircle,
  X,
  Search,
  ChevronRight,
  Shield,
  Save,
  Maximize2,
  Image,
  Star,
  RefreshCw,
  Pin
} from 'lucide-react';

const BEDWARS_ICON_URL =
  'https://cdn2.steamgriddb.com/icon/3ad9ecf4b4a26b7671e09283f001d626.png';

interface PlayerCardProps {
  player: Player;
  onDelete?: (playerId: string) => void;
  isAdmin?: boolean;
  isPinned?: boolean;
  onPinToggle?: (playerId: string, e: React.MouseEvent) => void;
  showPinIcon?: boolean;
  onTeammateClick?: (teammate: Player) => void;
}

function PlayerCard({ player, onDelete, isAdmin, isPinned, onPinToggle, showPinIcon, onTeammateClick }: PlayerCardProps) {
  const { user } = useAuth();
  const { kits } = useKits();
  const [showModal, setShowModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddStrategyModal, setShowAddStrategyModal] = useState(false);
  const [showRankClaimModal, setShowRankClaimModal] = useState(false);
  const [showTeammateModal, setShowTeammateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAlias, setEditingAlias] = useState(player.alias);
  const [editingYoutubeChannel, setEditingYoutubeChannel] = useState(
    player.youtube_channel || ''
  );
  const [newUserId, setNewUserId] = useState('');
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [starredKitId, setStarredKitId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedTeammates, setSelectedTeammates] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [kitSearchQuery, setKitSearchQuery] = useState('');
  const [teammateSearchQuery, setTeammateSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedRankId, setSelectedRankId] = useState<string>('');
  const [proofUrl, setProofUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ranks, setRanks] = useState<AccountRank[]>([]);
  const [editingAccount, setEditingAccount] = useState<PlayerAccount | null>(null);
  const [isUpdatingRank, setIsUpdatingRank] = useState(false);
  const [playerData, setPlayerData] = useState<Player>(player);
  const [showStrategyImages, setShowStrategyImages] = useState(true);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);
  const [availableTeammates, setAvailableTeammates] = useState<Player[]>([]);

  const getCommonKits = () => {
    const kitUsage = new Map<string, number>();
    
    playerData.strategies?.forEach(strategy => {
      if (strategy.starred_kit_id) {
        const count = kitUsage.get(strategy.starred_kit_id) || 0;
        kitUsage.set(strategy.starred_kit_id, count + 1);
      }
    });

    return Array.from(kitUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kitId, count]) => ({
        kit: kits.find(k => k.id === kitId),
        count
      }))
      .filter(item => item.kit);
  };

  const commonKits = getCommonKits();

  const filteredKits = kits.filter(kit => 
    kit.name.toLowerCase().includes(kitSearchQuery.toLowerCase())
  );

  const displayKits = filteredKits.slice(0, 8);

  useEffect(() => {
    fetchRanks();
    fetchAvailableTeammates();
  }, []);

  // Update playerData when player prop changes
  useEffect(() => {
    setPlayerData(player);
  }, [player]);

  const fetchRanks = async () => {
    try {
      const { data, error } = await supabase
        .from('account_ranks')
        .select('*')
        .order('name');

      if (error) throw error;
      setRanks(data || []);
    } catch (error) {
      console.error('Error fetching ranks:', error);
    }
  };

  const fetchAvailableTeammates = async () => {
    try {
      const { data, error } = await supabase
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
          )
        `)
        .neq('id', player.id);

      if (error) throw error;
      
      if (data) {
        // Fetch Roblox status data for all accounts
        const accountIds = data.accounts?.map(acc => acc.user_id) || [];
        
        // Also get teammate account IDs
        const teammateAccountIds = data.teammates?.flatMap(t => 
          t.teammate.accounts?.map(acc => acc.user_id) || []
        ) || [];
        
        // Combine all account IDs
        const allAccountIds = [...accountIds, ...teammateAccountIds];
        
        if (allAccountIds.length > 0) {
          console.log('📊 Fetching Roblox status for accounts:', allAccountIds);
          
          const { data: statusData, error: statusError } = await supabase
            .from('roblox_user_status')
            .select('*')
            .in('user_id', allAccountIds);
          
          if (statusError) {
            console.error('❌ Error fetching status data:', statusError);
          } else if (statusData) {
            console.log('✅ Fetched status data for', statusData.length, 'accounts');
            
            // Create a map of user_id to status
            const statusMap = new Map();
            statusData.forEach((status: any) => {
              statusMap.set(status.user_id, status);
            });
            
            // Merge status data with accounts
            const updatedAccounts = data.accounts?.map(acc => {
              const status = statusMap.get(acc.user_id);
              if (status) {
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
                  },
                };
              }
              return acc;
            });
            
            // Also update teammate accounts with status data
            const updatedTeammates = data.teammates?.map(teammate => ({
              ...teammate,
              teammate: {
                ...teammate.teammate,
                accounts: teammate.teammate.accounts?.map(acc => {
                  const status = statusMap.get(acc.user_id);
                  if (status) {
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
                      },
                    };
                  }
                  return acc;
                })
              }
            }));
            
            // Update the data with merged accounts and teammates
            data.accounts = updatedAccounts;
            data.teammates = updatedTeammates;
          }
        }
        
        console.log('✅ Player data refreshed successfully');
        setPlayerData(data);
      }
    } catch (error) {
      console.error('❌ Error refreshing player data:', error);
    }
  };

  const handleAddTeammate = async (teammateId: string) => {
    try {
      const { error } = await supabase
        .from('player_teammates')
        .insert({
          player_id: player.id,
          teammate_id: teammateId
        });

      if (error) throw error;
      await refreshPlayerData();
      setSuccess('Teammate added successfully');
    } catch (error) {
      console.error('Error adding teammate:', error);
      setError('Failed to add teammate');
    }
  };

  const handleRemoveTeammate = async (teammateId: string) => {
    try {
      const { error } = await supabase
        .from('player_teammates')
        .delete()
        .eq('player_id', player.id)
        .eq('teammate_id', teammateId);

      if (error) throw error;
      await refreshPlayerData();
      setSuccess('Teammate removed successfully');
    } catch (error) {
      console.error('Error removing teammate:', error);
      setError('Failed to remove teammate');
    }
  };

  const handleAddAccount = async () => {
    if (!newUserId) {
      setError('Please enter a Roblox User ID');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('player_accounts')
        .insert({
          player_id: player.id,
          user_id: parseInt(newUserId)
        })
        .select()
        .single();

      if (error) throw error;

      setShowAddAccountModal(false);
      setNewUserId('');
      setSuccess('Account added successfully');
      await refreshPlayerData();
    } catch (error) {
      console.error('Error adding account:', error);
      setError('Failed to add account');
    }
  };

  const handleAddStrategy = async () => {
    if (selectedKits.length !== 5 || !imageUrl) {
      setError('Please select 5 kits and provide an image URL');
      return;
    }

    if (!starredKitId) {
      setError('Please star the kit that this player uses');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('player_strategies')
        .insert({
          player_id: player.id,
          image_url: imageUrl,
          kit_ids: selectedKits,
          teammate_ids: selectedTeammates,
          starred_kit_id: starredKitId
        })
        .select()
        .single();

      if (error) throw error;

      setShowAddStrategyModal(false);
      setSelectedKits([]);
      setStarredKitId(null);
      setImageUrl('');
      setSelectedTeammates([]);
      setSuccess('Strategy added successfully');
      await refreshPlayerData();
    } catch (error) {
      console.error('Error adding strategy:', error);
      setError('Failed to add strategy');
    }
  };

  const handleSubmitRankClaim = async () => {
    if (!selectedAccountId || !selectedRankId || !proofUrl) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rank_update_claims')
        .insert({
          account_id: selectedAccountId,
          rank_id: selectedRankId,
          proof_url: proofUrl
        })
        .select()
        .single();

      if (error) throw error;

      setShowRankClaimModal(false);
      setSelectedAccountId('');
      setSelectedRankId('');
      setProofUrl('');
      setSuccess('Rank claim submitted successfully');
    } catch (error) {
      console.error('Error submitting rank claim:', error);
      setError('Failed to submit rank claim');
    }
  };

  const handleUpdateRank = async (accountId: string, rankId: string) => {
    try {
      setIsUpdatingRank(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('player_account_ranks')
        .delete()
        .eq('account_id', accountId);

      if (deleteError) throw deleteError;

      if (rankId) {
        const { error: insertError } = await supabase
          .from('player_account_ranks')
          .insert({
            account_id: accountId,
            rank_id: rankId
          });

        if (insertError) throw insertError;
      }

      await refreshPlayerData();
      setSuccess('Rank updated successfully');
    } catch (error) {
      console.error('Error updating rank:', error);
      setError('Failed to update rank');
    } finally {
      setIsUpdatingRank(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('player_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      setSuccess('Account deleted successfully');
      await refreshPlayerData();
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    try {
      const { error } = await supabase
        .from('player_strategies')
        .delete()
        .eq('id', strategyId);

      if (error) throw error;
      setSuccess('Strategy deleted successfully');
      await refreshPlayerData();
    } catch (error) {
      console.error('Error deleting strategy:', error);
      setError('Failed to delete strategy');
    }
  };

  const handleEditPlayer = async () => {
    try {
      const { error } = await supabase
        .from('players')
        .update({
          alias: editingAlias,
          youtube_channel: editingYoutubeChannel || null
        })
        .eq('id', player.id);

      if (error) throw error;

      setSuccess('Player updated successfully');
      setShowEditModal(false);
      await refreshPlayerData();
    } catch (error) {
      console.error('Error updating player:', error);
      setError('Failed to update player');
    }
  };

  const handleTeammateClick = (teammate: Player) => {
    // Close current modal
    setShowModal(false);
    
    // Use the callback to open the teammate's modal
    if (onTeammateClick) {
      onTeammateClick(teammate);
    } else {
      console.log('Opening teammate modal for:', teammate.alias);
    }
  };

  const getAccountRank = (account: PlayerAccount) => {
    if (!account.rank || !account.rank[0]) return null;
    return account.rank[0].account_ranks;
  };

  const renderCard = () => (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => setShowModal(true)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">{playerData.alias}</h3>
            {showPinIcon && onPinToggle && (
              <button
                onClick={(e) => onPinToggle(player.id, e)}
                className={`p-1 rounded-full transition-colors ${
                  isPinned 
                    ? 'text-yellow-500 hover:text-yellow-600' 
                    : 'text-gray-400 hover:text-yellow-500'
                }`}
                title={isPinned ? 'Unpin player' : 'Pin player'}
              >
                <Pin size={16} className={isPinned ? 'fill-current' : ''} />
              </button>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {playerData.accounts?.map(account => (
              <div key={account.id} className="flex items-center gap-2">
                <RobloxStatus 
                  username={account.status?.username || ''}
                  isOnline={account.status?.isOnline || false}
                  isInGame={account.status?.isInGame || false}
                  inBedwars={account.status?.inBedwars || false}
                  lastUpdated={account.status?.lastUpdated}
                />
                {getAccountRank(account) ? (
                  <img
                    src={getAccountRank(account)?.image_url}
                    alt={getAccountRank(account)?.name}
                    className="w-6 h-6"
                    title={getAccountRank(account)?.name}
                  />
                ) : (
                  <HelpCircle
                    size={16}
                    className="text-gray-400"
                    title="Rank unknown"
                  />
                )}
                {account.status?.inBedwars && (
                  <img
                    src={BEDWARS_ICON_URL}
                    alt="BedWars"
                    className="w-6 h-6"
                    title="In BedWars"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
              }}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onDelete) onDelete(player.id);
              }}
              className="p-2 text-red-600 hover:bg-red-100 rounded-full"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {playerData.strategies?.slice(0, 3).map(strategy => (
          strategy.kit_ids?.slice(0, 3).map(kitId => {
            const kit = kits.find(k => k.id === kitId);
            if (!kit) return null;
            return (
              <div key={kitId} className="w-8 h-8">
                <KitCard kit={kit} size="sm" showDetails={false} />
              </div>
            );
          })
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAddAccountModal(true);
          }}
          className="btn btn-outline flex items-center gap-1 text-sm"
        >
          <Plus size={14} />
          Add Account
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAddStrategyModal(true);
          }}
          className="btn btn-outline flex items-center gap-1 text-sm"
        >
          <Plus size={14} />
          Add Strategy
        </button>
      </div>
    </div>
  );

  const renderModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">{playerData.alias}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Users size={18} className="text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {playerData.teammates?.length || 0} Teammates
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-semibold mb-4">Known Accounts</h3>
            <div className="space-y-4">
              {playerData.accounts?.map(account => (
                <div 
                  key={account.id}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <RobloxStatus 
                        username={account.status?.username || ''}
                        isOnline={account.status?.isOnline || false}
                        isInGame={account.status?.isInGame || false}
                        inBedwars={account.status?.inBedwars || false}
                        lastUpdated={account.status?.lastUpdated}
                      />
                    </div>
                    {getAccountRank(account) ? (
                      <img
                        src={getAccountRank(account)?.image_url}
                        alt={getAccountRank(account)?.name}
                        className="w-8 h-8"
                        title={getAccountRank(account)?.name}
                      />
                    ) : (
                      <div className="flex items-center gap-1 text-gray-500">
                        <HelpCircle size={18} />
                        <span className="text-sm">Rank unknown</span>
                      </div>
                    )}
                    {account.status?.inBedwars && (
                      <img
                        src={BEDWARS_ICON_URL}
                        alt="BedWars"
                        className="w-8 h-8"
                        title="In Bedwars"
                      />
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <select
                        value={getAccountRank(account)?.id || ''}
                        onChange={(e) => handleUpdateRank(account.id, e.target.value)}
                        className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        disabled={isUpdatingRank}
                      >
                        <option value="">Set Rank</option>
                        {ranks.map(rank => (
                          <option key={rank.id} value={rank.id}>
                            {rank.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={isUpdatingRank}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Teammates</h3>
              <button
                onClick={() => setShowTeammateModal(true)}
                className="btn btn-outline flex items-center gap-2"
              >
                <Users size={18} />
                Manage Teammates
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playerData.teammates?.length === 0 ? (
                <p className="text-gray-500 text-sm col-span-full">No teammates added yet.</p>
              ) : (
                playerData.teammates?.map(teammate => {
                  // Get teammate's overall status
                  const teammateAccounts = teammate.teammate.accounts || [];
                  const hasOnlineAccount = teammateAccounts.some(acc => acc.status?.isOnline);
                  const hasInBedwarsAccount = teammateAccounts.some(acc => acc.status?.inBedwars);
                  
                  let statusText = 'Offline';
                  let statusColor = 'text-gray-400';
                  
                  if (hasOnlineAccount) {
                    if (hasInBedwarsAccount) {
                      statusText = 'Online - In BedWars';
                      statusColor = 'text-blue-600 dark:text-blue-400';
                    } else {
                      statusText = 'Online';
                      statusColor = 'text-green-600 dark:text-green-400';
                    }
                  }
                  
                  return (
                    <div 
                      key={teammate.teammate.id}
                      className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                      onClick={() => handleTeammateClick(teammate.teammate)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{teammate.teammate.alias}</div>
                        <div className={`text-sm ${statusColor}`}>
                          {statusText}
                        </div>
                        {/* Show teammate's accounts if they have any */}
                        {teammateAccounts.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {teammateAccounts.slice(0, 3).map(account => (
                              <div key={account.id} className="flex items-center gap-1">
                                {account.status?.inBedwars && (
                                  <img
                                    src={BEDWARS_ICON_URL}
                                    alt="BedWars"
                                    className="w-3 h-3"
                                    title="In BedWars"
                                  />
                                )}
                                {getAccountRank(account) && (
                                  <img
                                    src={getAccountRank(account)?.image_url}
                                    alt={getAccountRank(account)?.name}
                                    className="w-3 h-3"
                                    title={getAccountRank(account)?.name}
                                  />
                                )}
                              </div>
                            ))}
                            {teammateAccounts.length > 3 && (
                              <span className="text-xs text-gray-500">+{teammateAccounts.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {renderStrategiesSection()}

          <div className="flex justify-center pt-4">
            <button
              onClick={() => setShowRankClaimModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Shield size={18} />
              Submit Rank Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddAccountModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Add Account</h3>
          <button
            onClick={() => setShowAddAccountModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Roblox User ID
            </label>
            <input
              type="number"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              placeholder="Enter Roblox User ID"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAddAccountModal(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAccount}
              className="btn btn-primary"
            >
              Add Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddStrategyModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Add Strategy</h3>
          <button
            onClick={() => setShowAddStrategyModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Select 5 Kits
            </label>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search kits..."
                value={kitSearchQuery}
                onChange={(e) => setKitSearchQuery(e.target.value)}
                className="w-full p-2 pl-8 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
              {displayKits.map(kit => (
                <div
                  key={kit.id}
                  onClick={() => {
                    if (selectedKits.includes(kit.id)) {
                      setSelectedKits(prev => prev.filter(id => id !== kit.id));
                      if (starredKitId === kit.id) {
                        setStarredKitId(null);
                      }
                    } else if (selectedKits.length < 5) {
                      setSelectedKits(prev => [...prev, kit.id]);
                    }
                  }}
                  className={`relative cursor-pointer ${
                    selectedKits.includes(kit.id) 
                      ? 'ring-2 ring-primary-500' 
                      : ''
                  }`}
                >
                  <KitCard kit={kit} size="sm" />
                  {selectedKits.includes(kit.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStarredKitId(starredKitId === kit.id ? null : kit.id);
                      }}
                      className={`absolute top-1 right-1 p-1 rounded-full ${
                        starredKitId === kit.id
                          ? 'text-yellow-500'
                          : 'text-gray-400 hover:text-yellow-500'
                      }`}
                      title={starredKitId === kit.id ? 'Unstar kit' : 'Star this kit to indicate it is used by the player'}
                    >
                      <Star size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Star the kit that {player.alias} uses in this strategy
            </p>
          </div>

          {commonKits.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Commonly Used Kits:</h4>
              <div className="flex gap-2">
                {commonKits.map(({ kit, count }) => (
                  <div key={kit.id} className="relative">
                    <KitCard kit={kit} size="sm" />
                    <div className="absolute -top-2 -right-2 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAddStrategyModal(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStrategy}
              className="btn btn-primary"
            >
              Add Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRankClaimModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4">Submit Rank Update</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select account...</option>
              {playerData.accounts?.map(account => (
                <option key={account.id} value={account.id}>
                  {account.status?.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              New Rank
            </label>
            <select
              value={selectedRankId}
              onChange={(e) => setSelectedRankId(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select rank...</option>
              {ranks.map(rank => (
                <option key={rank.id} value={rank.id}>
                  {rank.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Proof URL (Screenshot/Video)
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowRankClaimModal(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRankClaim}
              className="btn btn-primary flex items-center gap-2"
            >
              <Upload size={18} />
              Submit Claim
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeammateModal = () => {
    const filteredTeammates = availableTeammates.filter(t => 
      t.alias.toLowerCase().includes(teammateSearchQuery.toLowerCase()) &&
      !playerData.teammates?.some(pt => pt.teammate.id === t.id)
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Manage Teammates</h3>
          
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search players..."
                value={teammateSearchQuery}
                onChange={(e) => setTeammateSearchQuery(e.target.value)}
                className="w-full p-2 pl-10 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Current Teammates</h4>
                {playerData.teammates?.length === 0 ? (
                  <p className="text-gray-500 text-sm">No teammates added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {playerData.teammates?.map(teammate => (
                      <div
                        key={teammate.teammate.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{teammate.teammate.alias}</span>
                            <button
                              onClick={() => handleRemoveTeammate(teammate.teammate.id)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Remove teammate"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          
                          {/* Show teammate's accounts and status */}
                          {teammate.teammate.accounts && teammate.teammate.accounts.length > 0 ? (
                            <div className="space-y-1">
                              {teammate.teammate.accounts.map(account => (
                                <div key={account.id} className="flex items-center gap-2 text-sm">
                                  <RobloxStatus 
                                    username={account.status?.username || account.user_id.toString()}
                                    isOnline={account.status?.isOnline || false}
                                    isInGame={account.status?.isInGame || false}
                                    inBedwars={account.status?.inBedwars || false}
                                    lastUpdated={account.status?.lastUpdated}
                                  />
                                  {getAccountRank(account) && (
                                    <img
                                      src={getAccountRank(account)?.image_url}
                                      alt={getAccountRank(account)?.name}
                                      className="w-4 h-4"
                                      title={getAccountRank(account)?.name}
                                    />
                                  )}
                                  {account.status?.inBedwars && (
                                    <img
                                      src={BEDWARS_ICON_URL}
                                      alt="BedWars"
                                      className="w-4 h-4"
                                      title="In BedWars"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No accounts found</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Available Players</h4>
                {filteredTeammates.length === 0 ? (
                  <p className="text-gray-500 text-sm">No available players found.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredTeammates.map(teammate => (
                      <div
                        key={teammate.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{teammate.alias}</span>
                            <button
                              onClick={() => handleAddTeammate(teammate.id)}
                              className="text-green-600 hover:text-green-700 p-1"
                              title="Add as teammate"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          
                          {/* Show available player's accounts and status */}
                          {teammate.accounts && teammate.accounts.length > 0 ? (
                            <div className="space-y-1">
                              {teammate.accounts.map(account => (
                                <div key={account.id} className="flex items-center gap-2 text-sm">
                                  <RobloxStatus 
                                    username={account.status?.username || account.user_id.toString()}
                                    isOnline={account.status?.isOnline || false}
                                    isInGame={account.status?.isInGame || false}
                                    inBedwars={account.status?.inBedwars || false}
                                    lastUpdated={account.status?.lastUpdated}
                                  />
                                  {getAccountRank(account) && (
                                    <img
                                      src={getAccountRank(account)?.image_url}
                                      alt={getAccountRank(account)?.name}
                                      className="w-4 h-4"
                                      title={getAccountRank(account)?.name}
                                    />
                                  )}
                                  {account.status?.inBedwars && (
                                    <img
                                      src={BEDWARS_ICON_URL}
                                      alt="BedWars"
                                      className="w-4 h-4"
                                      title="In BedWars"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No accounts found</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTeammateModal(false)}
                className="btn btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStrategiesSection = () => (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Strategies</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStrategyImages(!showStrategyImages)}
            className="btn btn-outline flex items-center gap-2"
          >
            <Image size={18} />
            {showStrategyImages ? 'Hide Images' : 'Show Images'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
        {playerData.strategies?.map(strategy => (
          <div 
            key={strategy.id}
            className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
          >
            {showStrategyImages && (
              <div className="relative">
                <img
                  src={strategy.image_url}
                  alt="Strategy"
                  className={`w-full h-32 object-cover rounded mb-3 cursor-pointer transition-transform ${
                    expandedStrategyId === strategy.id ? 'scale-100' : 'hover:scale-105'
                  }`}
                  onClick={() => setExpandedStrategyId(
                    expandedStrategyId === strategy.id ? null : strategy.id
                  )}
                />
                <button
                  className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                  onClick={() => setExpandedStrategyId(
                    expandedStrategyId === strategy.id ? null : strategy.id
                  )}
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {strategy.kit_ids.map(kitId => {
                const kit = kits.find(k => k.id === kitId);
                if (!kit) return null;
                return (
                  <div key={kitId} className="w-8 h-8">
                    <KitCard kit={kit} size="sm" showDetails={false} />
                  </div>
                );
              })}
            </div>
            {isAdmin && (
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => handleDeleteStrategy(strategy.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {expandedStrategyId && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative max-w-4xl w-full mx-4">
            <button
              onClick={() => setExpandedStrategyId(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img
              src={playerData.strategies?.find(s => s.id === expandedStrategyId)?.image_url}
              alt="Strategy"
              className="w-full h-auto rounded"
            />
          </div>
        </div>
      )}
    </section>
  );

  const renderEditModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4">Edit Player</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Player Alias
            </label>
          <input
            type="text"
            value={editingAlias}
            onChange={(e) => setEditingAlias(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            YouTube Channel (Optional)
          </label>
          <input
            type="text"
            value={editingYoutubeChannel}
            onChange={(e) => setEditingYoutubeChannel(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowEditModal(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleEditPlayer}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderCard()}
      {showModal && renderModal()}
      {showAddAccountModal && renderAddAccountModal()}
      {showAddStrategyModal && renderAddStrategyModal()}
      {showRankClaimModal && renderRankClaimModal()}
      {showTeammateModal && renderTeammateModal()}
      {showEditModal && renderEditModal()}
    </>
  );
}

export default PlayerCard;
