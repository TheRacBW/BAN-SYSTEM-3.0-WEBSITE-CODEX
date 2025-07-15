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
  Pin,
  Crown,
  Check
} from 'lucide-react';

const BEDWARS_ICON_URL =
  'https://cdn2.steamgriddb.com/icon/3ad9ecf4b4a26b7671e09283f001d626.png';

// Rank icon mapping with provided URLs
const RANK_ICONS = {
  'Bronze': 'https://static.wikia.nocookie.net/robloxbedwars/images/5/5a/Bronze_Rank_Icon.png/revision/latest/scale-to-width-down/250?cb=20211107172921',
  'Silver': 'https://static.wikia.nocookie.net/robloxbedwars/images/6/64/Silver_Rank_Icon.png/revision/latest/scale-to-width-down/250?cb=20211107172857',
  'Gold': 'https://static.wikia.nocookie.net/robloxbedwars/images/9/92/Gold_Rank_Icon.png/revision/latest/scale-to-width-down/250?cb=20211107172909',
  'Platinum': 'https://static.wikia.nocookie.net/robloxbedwars/images/0/08/Platinum_Rank_Icon.png/revision/latest/scale-to-width-down/250?cb=20211107172934',
  'Diamond': 'https://static.wikia.nocookie.net/robloxbedwars/images/c/cb/Diamond_Rank_Icon.png/revision/latest/scale-to-width-down/250?cb=20211105223753',
  'Emerald': 'https://static.wikia.nocookie.net/robloxbedwars/images/0/06/Emerald_Rank_Icon.png/revision/latest?cb=20230407130803',
  'Nightmare': 'https://static.wikia.nocookie.net/robloxbedwars/images/7/76/Nightmare_Rank_Icon.png/revision/latest?cb=20211107172948'
};

// Type for teammate relationship from database
interface TeammateRelationship {
  teammate: Player & {
    accounts?: PlayerAccount[];
  };
}

interface PlayerCardProps {
  player: Player;
  onDelete?: (playerId: string) => void;
  isAdmin?: boolean;
  isPinned?: boolean;
  onPinToggle?: (playerId: string, e: React.MouseEvent) => void;
  showPinIcon?: boolean;
  onTeammateClick?: (teammate: Player) => void;
  onPlayerUpdate?: (playerId: string) => void;
  onNavigateToPlayer?: (playerId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

// --- Safe Roblox Profile Integration ---
interface RobloxProfile {
  username: string;
  user_id: number;
  profile_picture_url?: string;
  cached_at: string;
  source?: 'cache' | 'status';
}

const useRobloxProfiles = (playerAccounts: any[]) => {
  const [profiles, setProfiles] = useState<Map<string, RobloxProfile>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchRobloxProfiles = async () => {
    if (!playerAccounts?.length) return;
    setLoading(true);
    try {
      const usernames = [...new Set(
        playerAccounts
          .map(acc => acc.username)
          .filter(Boolean)
          .filter(username => typeof username === 'string' && username.trim().length > 0)
      )];
      if (usernames.length === 0) {
        setProfiles(new Map());
        return;
      }
      // Cache first
      const { data: cachedProfiles } = await supabase
        .from('roblox_user_cache')
        .select('username, user_id, profile_picture_url, cached_at')
        .in('username', usernames);
      const profileMap = new Map<string, RobloxProfile>();
      cachedProfiles?.forEach(profile => {
        if (profile.user_id && profile.username) {
          profileMap.set(profile.username, {
            username: profile.username,
            user_id: profile.user_id,
            profile_picture_url: profile.profile_picture_url || undefined,
            cached_at: profile.cached_at,
            source: 'cache'
          });
        }
      });
      // Fallback to status table
      const missingUsernames = usernames.filter(username => !profileMap.has(username));
      if (missingUsernames.length > 0) {
        const { data: statusProfiles } = await supabase
          .from('roblox_user_status')
          .select('username, user_id')
          .in('username', missingUsernames)
          .not('user_id', 'is', null)
          .not('username', 'is', null);
        statusProfiles?.forEach(profile => {
          if (profile.user_id && profile.username && !profileMap.has(profile.username)) {
            profileMap.set(profile.username, {
              username: profile.username,
              user_id: Number(profile.user_id),
              profile_picture_url: undefined,
              cached_at: new Date().toISOString(),
              source: 'status'
            });
          }
        });
      }
      setProfiles(profileMap);
    } catch (error) {
      setProfiles(new Map());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRobloxProfiles();
  }, [JSON.stringify(playerAccounts?.map(acc => acc.username))]);

  return { profiles, loading, refetch: fetchRobloxProfiles };
};

interface RobloxProfilePictureProps {
  username: string;
  profile?: RobloxProfile;
  size?: 'sm' | 'md' | 'lg';
  showLink?: boolean;
  className?: string;
}

const RobloxProfilePicture: React.FC<RobloxProfilePictureProps> = ({
  username,
  profile,
  size = 'md',
  showLink = false, // Avatar is NOT a link
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClass = 'w-12 h-12';
  // Fallback: username or user_id or ''
  const safeUsername = typeof username === 'string' && username.trim().length > 0
    ? username
    : (profile?.user_id ? String(profile.user_id) : '');
  // Avatar fallback order: cache -> API -> default
  const getProfilePictureUrl = () => {
    if (profile?.profile_picture_url && !imageError) {
      return profile.profile_picture_url;
    }
    if (profile?.user_id && !imageError) {
      return `https://www.roblox.com/headshot-thumbnail/image?userId=${profile.user_id}&width=150&height=150&format=png`;
    }
    return '/default-avatar.svg';
  };
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-gray-300 dark:border-gray-600 ${className}`}>
      <img
        src={getProfilePictureUrl()}
        alt={`${safeUsername}'s Roblox avatar`}
        className="w-full h-full object-cover"
        onError={e => {
          setImageError(true);
          e.currentTarget.src = '/default-avatar.svg';
        }}
      />
    </div>
  );
};

const AccountListWithProfiles = ({ accounts, onDeleteAccount, isAdmin, ranks, handleUpdateRank, isUpdatingRank }: { 
  accounts: any[], 
  onDeleteAccount: (accountId: string) => void,
  isAdmin?: boolean,
  ranks: AccountRank[],
  handleUpdateRank: (accountId: string, rankId: string) => void,
  isUpdatingRank: boolean
}) => {
  const { profiles, loading } = useRobloxProfiles(accounts);
  if (!accounts?.length) {
    return (
      <div className="text-sm text-gray-500 italic">
        No accounts added yet
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
          Accounts ({accounts.length})
        </h4>
        {loading && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            Loading profiles...
          </div>
        )}
      </div>
      {accounts.map((account) => {
        // Always prefer account.user_id for link and avatar
        const userId = account.user_id || profiles.get(account.username)?.user_id;
        const profile = profiles.get(account.username);
        const status = account.status;
        const rank = account.rank && Array.isArray(account.rank) && account.rank.length > 0 ? account.rank[0].account_ranks : null;
        // Display name: username or user_id or ''
        const displayName = account.username || '';
        // Hyperlink if user_id
        const profileLink = userId ? `https://www.roblox.com/users/${userId}/profile` : undefined;
        // Avatar src: cache, else API, else default
        const avatarUrl = profile?.profile_picture_url
          ? profile.profile_picture_url
          : (userId ? `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png` : '/default-avatar.svg');
        return (
          <div
            key={account.id}
            className="flex items-center gap-x-3 min-h-[48px] bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-300/40 dark:border-gray-700/60 px-3 py-3 shadow-md transition-all hover:shadow-lg hover:border-blue-400"
          >
            {/* Avatar (not a link) */}
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-gray-300 dark:border-gray-600">
              <img
                src={avatarUrl}
                alt={displayName ? `${displayName}'s Roblox avatar` : 'Roblox avatar'}
                className="w-full h-full object-cover"
                onError={e => { e.currentTarget.src = '/default-avatar.svg'; }}
              />
            </div>
            {/* Username/status + rank badge (center), admin controls (right) */}
            <div className="flex flex-1 items-center min-w-0">
              {/* Username/status and ID (left) */}
              <div className="flex flex-col min-w-0 flex-1 items-start">
                <div className="flex items-center min-w-0 w-full">
                  {profileLink ? (
                    <a
                      href={profileLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-x-2 font-medium text-base truncate hover:underline text-blue-700 dark:text-blue-300 -ml-2"
                      title={`View ${displayName || userId ? (displayName || userId) : 'Roblox'}'s Roblox profile`}
                    >
                      <span>{displayName}</span>
                      <RobloxStatus 
                        username={status?.username || displayName || userId}
                        isOnline={status?.isOnline || false}
                        isInGame={status?.isInGame || false}
                        inBedwars={status?.inBedwars || false}
                        lastUpdated={status?.lastUpdated}
                      />
                    </a>
                  ) : (
                    <span className="flex items-center gap-x-2 font-medium text-base truncate text-gray-700 dark:text-gray-300 -ml-2">
                      <span>{displayName}</span>
                      <RobloxStatus 
                        username={status?.username || displayName || userId}
                        isOnline={status?.isOnline || false}
                        isInGame={status?.isInGame || false}
                        inBedwars={status?.inBedwars || false}
                        lastUpdated={status?.lastUpdated}
                      />
                    </span>
                  )}
                  {/* Rank badge (right, same line) */}
                  <div className="flex-shrink-0 ml-auto pl-2">
                    {rank && rank.image_url ? (
                      <img src={rank.image_url} alt={rank.name} className="w-8 h-8 object-contain" title={rank.name} />
                    ) : rank ? (
                      <span className="text-xs font-bold text-blue-600 border border-blue-300 rounded px-1" title={rank.name}>{rank.name[0]}</span>
                    ) : (
                      <HelpCircle size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>
                {userId && (
                  <span className="text-xs text-gray-500">ID: {userId}</span>
                )}
                {profile?.source && (
                  <span className={`px-1 py-0.5 rounded text-xs ${
                    profile.source === 'cache' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {profile.source}
                  </span>
                )}
              </div>
              {/* Admin controls (right) */}
              {isAdmin && (
                <div className="flex flex-col items-end gap-1 min-w-[110px] ml-4">
                  <div className="flex items-center gap-2 w-full">
                    <select
                      value={rank?.id || ''}
                      onChange={e => handleUpdateRank(account.id, e.target.value)}
                      className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      disabled={isUpdatingRank}
                      onClick={e => e.stopPropagation()}
                      onFocus={e => e.stopPropagation()}
                    >
                      <option value="" className="dark:bg-gray-700 dark:text-gray-100">Set Rank</option>
                      {ranks.map(rankOpt => (
                        <option key={rankOpt.id} value={rankOpt.id} className="dark:bg-gray-700 dark:text-gray-100">{rankOpt.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => onDeleteAccount(account.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete account"
                      disabled={isUpdatingRank}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function PlayerCard({ player, onDelete, isAdmin, isPinned, onPinToggle, showPinIcon, onTeammateClick, onPlayerUpdate, onNavigateToPlayer, onClose, isModal }: PlayerCardProps) {
  console.log('🎯 MAIN PlayerCard rendering:', player.alias, {
    hasAccounts: player.accounts?.length || 0,
    hasStatus: player.accounts?.[0]?.status ? 'yes' : 'no',
    firstAccountStatus: player.accounts?.[0]?.status ? 'has-status' : 'no-status'
  });
  
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
      // Note: starred_kit_id is not in the type, so we'll use the first kit as starred
      if (strategy.kit_ids && strategy.kit_ids.length > 0) {
        const starredKitId = strategy.kit_ids[0]; // Use first kit as starred
        const count = kitUsage.get(starredKitId) || 0;
        kitUsage.set(starredKitId, count + 1);
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
    fetchCurrentTeammatesWithStatus();
  }, []);

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showAddAccountModal || showAddStrategyModal || showTeammateModal || showRankClaimModal || showEditModal) {
      document.body.classList.add('modal-open');
      return () => document.body.classList.remove('modal-open');
    }
  }, [showAddAccountModal, showAddStrategyModal, showTeammateModal, showRankClaimModal, showEditModal]);

  // Update playerData when player prop changes
  useEffect(() => {
    setPlayerData(player);
    // Refresh teammate data when player prop changes
    fetchCurrentTeammatesWithStatus();
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
      console.log('🔍 Fetching available teammates for player:', player.alias);
      
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          accounts:player_accounts(
            id,
            user_id
          )
        `)
        .neq('id', player.id);

      if (error) throw error;
      
      if (data) {
        // Fetch status data for all accounts
        const allUserIds = data.flatMap((p: any) => p.accounts?.map((a: any) => a.user_id) || []);
        
        if (allUserIds.length > 0) {
          console.log('📊 Fetching status data for user IDs:', allUserIds);
          
          const { data: statusData, error: statusError } = await supabase
            .from('roblox_user_status')
            .select('*')
            .in('user_id', allUserIds);

          if (statusError) {
            console.error('❌ Error fetching status data:', statusError);
          } else if (statusData) {
            console.log('✅ Fetched status data for', statusData.length, 'accounts');
            
            // Create a map of user_id to status
            const statusMap = new Map();
            statusData.forEach((status: any) => {
              statusMap.set(status.user_id, status);
            });
            
            // Map status data to players
            const playersWithStatus = data.map((player: any) => ({
              ...player,
              accounts: player.accounts?.map((account: any) => ({
                ...account,
                status: statusMap.get(account.user_id) ? {
                  isOnline: statusMap.get(account.user_id).is_online,
                  isInGame: statusMap.get(account.user_id).is_in_game ?? false,
                  inBedwars: typeof statusMap.get(account.user_id).in_bedwars === 'boolean'
                    ? statusMap.get(account.user_id).in_bedwars
                    : (statusMap.get(account.user_id).is_in_game ?? false) && (
                        Number(statusMap.get(account.user_id).place_id) === BEDWARS_PLACE_ID ||
                        Number(statusMap.get(account.user_id).root_place_id) === BEDWARS_PLACE_ID ||
                        Number(statusMap.get(account.user_id).universe_id) === BEDWARS_UNIVERSE_ID
                      ),
                  userPresenceType: statusMap.get(account.user_id).user_presence_type,
                  placeId: statusMap.get(account.user_id).place_id,
                  rootPlaceId: statusMap.get(account.user_id).root_place_id,
                  universeId: statusMap.get(account.user_id).universe_id,
                  presenceMethod: statusMap.get(account.user_id).presence_method,
                  username: statusMap.get(account.user_id).username,
                  lastUpdated: new Date(statusMap.get(account.user_id).last_updated).getTime(),
                } : null
              })) || []
            }));
            
            console.log('✅ Available teammates with status:', playersWithStatus);
            setAvailableTeammates(playersWithStatus as any);
          } else {
            console.log('⚠️ No status data found');
            setAvailableTeammates(data as any);
          }
        } else {
          console.log('⚠️ No user IDs found');
          setAvailableTeammates(data as any);
        }
      } else {
        console.log('⚠️ No available teammates found');
        setAvailableTeammates([]);
      }
    } catch (error) {
      console.error('❌ Error fetching available teammates:', error);
      setAvailableTeammates([]);
    }
  };

  const fetchCurrentTeammatesWithStatus = async () => {
    try {
      console.log('🔄 Fetching current teammates with status for player:', player.alias);
      
      const { data, error } = await supabase
        .from('player_teammates')
        .select(`
          teammate:players!teammate_id(
            *,
            accounts:player_accounts(
              id,
              user_id
            )
          )
        `)
        .eq('player_id', player.id);

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Get all user IDs from teammates
        const allUserIds = data.flatMap((t: any) => 
          t.teammate?.accounts?.map((a: any) => a.user_id) || []
        );
        
        if (allUserIds.length > 0) {
          console.log('📊 Fetching status data for teammate user IDs:', allUserIds);
          
          // Fetch status data for all teammate accounts
          const { data: statusData, error: statusError } = await supabase
            .from('roblox_user_status')
            .select('*')
            .in('user_id', allUserIds);

          if (!statusError && statusData) {
            const statusMap = new Map(statusData.map((s: any) => [s.user_id, s]));
            
            // Map status to teammates
            const teammatesWithStatus = data.map((teammate: any) => ({
              ...teammate,
              teammate: {
                ...teammate.teammate,
                accounts: teammate.teammate?.accounts?.map((account: any) => ({
                  ...account,
                  status: statusMap.get(account.user_id) ? {
                    isOnline: statusMap.get(account.user_id).is_online,
                    isInGame: statusMap.get(account.user_id).is_in_game ?? false,
                    inBedwars: typeof statusMap.get(account.user_id).in_bedwars === 'boolean'
                      ? statusMap.get(account.user_id).in_bedwars
                      : (statusMap.get(account.user_id).is_in_game ?? false) && (
                          Number(statusMap.get(account.user_id).place_id) === BEDWARS_PLACE_ID ||
                          Number(statusMap.get(account.user_id).root_place_id) === BEDWARS_PLACE_ID ||
                          Number(statusMap.get(account.user_id).universe_id) === BEDWARS_UNIVERSE_ID
                        ),
                    userPresenceType: statusMap.get(account.user_id).user_presence_type,
                    placeId: statusMap.get(account.user_id).place_id,
                    rootPlaceId: statusMap.get(account.user_id).root_place_id,
                    universeId: statusMap.get(account.user_id).universe_id,
                    presenceMethod: statusMap.get(account.user_id).presence_method,
                    username: statusMap.get(account.user_id).username,
                    lastUpdated: new Date(statusMap.get(account.user_id).last_updated).getTime(),
                  } : null
                })) || []
              }
            }));
            
            console.log('✅ Current teammates with status:', teammatesWithStatus);
            
            // Update playerData with the enhanced teammate data
            setPlayerData(prevData => ({
              ...prevData,
              teammates: teammatesWithStatus as any
            }));
          } else {
            console.log('⚠️ No status data found for teammates');
            setPlayerData(prevData => ({
              ...prevData,
              teammates: data as any
            }));
          }
        } else {
          console.log('⚠️ No user IDs found in teammates');
          setPlayerData(prevData => ({
            ...prevData,
            teammates: data as any
          }));
        }
      } else {
        console.log('⚠️ No current teammates found');
        setPlayerData(prevData => ({
          ...prevData,
          teammates: []
        }));
      }
    } catch (error) {
      console.error('❌ Error fetching current teammates:', error);
    }
  };

  const handleAddTeammate = async (teammateId: string) => {
    console.log('🔄 Adding teammate:', teammateId, 'to player:', player.id);
    try {
      // Add relationship A -> B
      const { error: error1 } = await supabase
        .from('player_teammates')
        .insert({
          player_id: player.id,
          teammate_id: teammateId
        });

      // Add inverse relationship B -> A
      const { error: error2 } = await supabase
        .from('player_teammates')
        .insert({
          player_id: teammateId,
          teammate_id: player.id
        });

      if (error1 || error2) throw error1 || error2;

      console.log('✅ Teammate added successfully (bidirectional)');
      setSuccess('Teammate added successfully (bidirectional)');
      
      // Notify parent component to refresh player data
      if (onPlayerUpdate) {
        console.log('📞 Notifying parent to refresh player data');
        onPlayerUpdate(player.id);
      } else {
        console.log('⚠️ No onPlayerUpdate callback provided');
      }
      
      // Refresh available teammates list to update UI immediately
      await fetchAvailableTeammates();
      
      // Refresh current teammates with status data
      await fetchCurrentTeammatesWithStatus();
      
    } catch (error) {
      console.error('❌ Error adding teammate:', error);
      setError('Failed to add teammate');
    }
  };

  const handleRemoveTeammate = async (teammateId: string) => {
    console.log('🔄 Removing teammate:', teammateId, 'from player:', player.id);
    try {
      // Remove relationship A -> B
      const { error: error1 } = await supabase
        .from('player_teammates')
        .delete()
        .eq('player_id', player.id)
        .eq('teammate_id', teammateId);

      // Remove inverse relationship B -> A
      const { error: error2 } = await supabase
        .from('player_teammates')
        .delete()
        .eq('player_id', teammateId)
        .eq('teammate_id', player.id);

      if (error1 || error2) throw error1 || error2;
      
      console.log('✅ Teammate removed successfully (bidirectional)');
      setSuccess('Teammate removed successfully (bidirectional)');
      
      // Notify parent component to refresh player data
      if (onPlayerUpdate) {
        console.log('📞 Notifying parent to refresh player data');
        onPlayerUpdate(player.id);
      } else {
        console.log('⚠️ No onPlayerUpdate callback provided');
      }
      
      // Refresh available teammates list to update UI immediately
      await fetchAvailableTeammates();
      
      // Refresh current teammates with status data
      await fetchCurrentTeammatesWithStatus();
    } catch (error) {
      console.error('❌ Error removing teammate:', error);
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
    } catch (error) {
      console.error('Error updating player:', error);
      setError('Failed to update player');
    }
  };

  const handleTeammateNavigation = (teammateId: string) => {
    console.log(`Navigating to teammate ${teammateId}`);
    if (onClose) onClose(); // Close current modal
    if (onNavigateToPlayer) onNavigateToPlayer(teammateId); // Open new modal
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

  const getAccountRank = (account: PlayerAccount): AccountRank | null => {
    try {
      // Handle array structure from database
      if (account.rank && Array.isArray(account.rank) && account.rank.length > 0) {
        return account.rank[0].account_ranks; // Get first rank from array
      }
      
      return null;
    } catch (error) {
      console.error('Error getting account rank:', error);
      return null;
    }
  };

  // Get rank icon URL with fallback
  const getRankIconUrl = (rank: AccountRank) => {
    const fallbackUrl = RANK_ICONS[rank.name as keyof typeof RANK_ICONS];
    return fallbackUrl || rank.image_url;
  };

  // Enhanced Star Icon Component with better visibility
  const EnhancedStarIcon = ({ isStarred, onClick }: { isStarred: boolean; onClick: (e: React.MouseEvent) => void }) => {
    return (
      <button
        onClick={onClick}
        className={`absolute top-1 right-1 p-1 rounded-full transition-all duration-200 star-icon ${
          isStarred ? 'starred' : ''
        }`}
        title={isStarred ? 'Unstar kit' : 'Star this kit to indicate it is used by the player'}
      >
        {isStarred ? (
          // Option 1: Enhanced filled star with glow
          <div className="relative">
            <Star 
              size={20} 
              className="text-yellow-400 fill-yellow-400"
            />
            {/* Sparkle effect */}
            <div className="absolute inset-0 animate-pulse">
              <Star 
                size={20} 
                className="text-yellow-200 fill-yellow-200 opacity-50"
              />
            </div>
          </div>
        ) : (
          // Unstarred state with subtle hover effect
          <Star 
            size={20} 
            className="text-gray-400 hover:text-yellow-400 transition-colors duration-200"
          />
        )}
      </button>
    );
  };

  // Alternative Crown Icon Component
  const CrownIcon = ({ isStarred, onClick }: { isStarred: boolean; onClick: (e: React.MouseEvent) => void }) => {
    return (
      <button
        onClick={onClick}
        className="absolute top-1 right-1 p-1 rounded-full transition-all duration-200"
        title={isStarred ? 'Unstar kit' : 'Star this kit to indicate it is used by the player'}
      >
        {isStarred ? (
          <Crown 
            size={20} 
            className="text-yellow-400 fill-yellow-400 drop-shadow-lg animate-pulse"
          />
        ) : (
          <Crown 
            size={20} 
            className="text-gray-400 hover:text-yellow-400 transition-colors"
          />
        )}
      </button>
    );
  };

  // Alternative Badge/Checkmark Component
  const StarredBadge = ({ isStarred, onClick }: { isStarred: boolean; onClick: (e: React.MouseEvent) => void }) => {
    return (
      <button
        onClick={onClick}
        className="absolute top-1 right-1 transition-all duration-200"
        title={isStarred ? 'Unstar kit' : 'Star this kit to indicate it is used by the player'}
      >
        {isStarred ? (
          <div className="bg-yellow-400 text-black rounded-full p-1 shadow-lg animate-pulse">
            <Check size={12} className="font-bold" />
          </div>
        ) : (
          <div className="bg-gray-400 text-white rounded-full p-1 hover:bg-yellow-400 hover:text-black transition-all">
            <Check size={12} />
          </div>
        )}
      </button>
    );
  };

  // Rank Icon Component with proper error handling
  const RankIcon = ({ account }: { account: PlayerAccount }) => {
    const rank = getAccountRank(account);
    
    // Log for debugging (console only - no UI)
    console.log('RankIcon debug:', {
      accountId: account.id,
      userId: account.user_id,
      rankArray: account.rank,
      processedRank: rank
    });
    
    if (!rank) {
      return <HelpCircle size={14} className="text-gray-400" />;
    }
    
    // Try to use the database image URL
    if (rank.image_url) {
      return (
        <img 
          src={rank.image_url}
          alt={rank.name}
          className="w-4 h-4 object-contain"
          title={rank.name}
          onLoad={() => console.log(`✅ Rank icon loaded: ${rank.name}`)}
          onError={(e) => {
            console.log(`❌ Rank icon failed: ${rank.name}`, rank.image_url);
            // Replace with text fallback
            const fallback = document.createElement('span');
            fallback.className = 'text-xs font-bold text-blue-600 border border-blue-300 rounded px-1';
            fallback.textContent = rank.name[0];
            fallback.title = rank.name;
            e.currentTarget.parentNode?.replaceChild(fallback, e.currentTarget);
          }}
        />
      );
    }
    
    // Text fallback
    return (
      <span 
        className="text-xs font-bold text-blue-600 border border-blue-300 rounded px-1"
        title={rank.name}
      >
        {rank.name[0]}
      </span>
    );
  };

  // Sort accounts by priority: Bedwars > In Game > Online > Offline
  const getSortedAccounts = () => {
    if (!playerData.accounts) return [];
    
    return [...playerData.accounts].sort((a: PlayerAccount, b: PlayerAccount) => {
      const aStatus = a.status;
      const bStatus = b.status;
      
      // Priority: Bedwars (highest) > In Game > Online > Offline (lowest)
      const getPriority = (status: any) => {
        if (status?.inBedwars) return 4;
        if (status?.isInGame) return 3;
        if (status?.isOnline) return 2;
        return 1; // Offline
      };
      
      return getPriority(bStatus) - getPriority(aStatus);
    });
  };

  const renderCard = () => {
    const sortedAccounts = getSortedAccounts();
    const accountCount = sortedAccounts.length;
    const maxVisibleAccounts = 2;
    const showScrollbar = accountCount > maxVisibleAccounts;

    const handleCardClick = () => {
      // Don't open PlayerCard modal if any sub-modal is open
      if (showAddAccountModal || showAddStrategyModal || showTeammateModal || showRankClaimModal || showEditModal) {
        return; // Block card click when modals are open
      }
      
      // Only open if no other modals are active
      if (onTeammateClick) {
        onTeammateClick(player);
      }
    };

    return (
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-64 flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
        onClick={handleCardClick}
      >
        {/* Header with pin, edit, delete buttons */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
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

        {/* Known Accounts section with proper spacing */}
        {accountCount > 0 && (
          <div className="flex-1 min-h-0 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Known Accounts
              </h4>
              {showScrollbar && (
                <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                  <Users size={12} />
                  <span>{accountCount}</span>
                </div>
              )}
            </div>
            
            {/* Fixed height container showing max 2 accounts */}
            <div className={`space-y-2 ${showScrollbar ? 'h-16 overflow-y-auto pr-2' : ''}`}>
              {sortedAccounts.map(account => (
                <div key={account.id} className="flex items-center gap-2 min-h-[28px]">
                  <RobloxStatus 
                    username={account.status?.username || `User ${account.user_id}`}
                    isOnline={account.status?.isOnline || false}
                    isInGame={account.status?.isInGame || false}
                    inBedwars={account.status?.inBedwars || false}
                    lastUpdated={account.status?.lastUpdated}
                  />
                  <div className="w-8 h-8 flex items-center justify-center">
                    <RankIcon account={account} />
                  </div>
                  {account.status?.inBedwars && (
                    <img
                      src={BEDWARS_ICON_URL}
                      alt="BedWars"
                      className="w-8 h-8"
                      title="In BedWars"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strategy kits */}
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

        {/* Action buttons at bottom */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔘 Add Account button clicked!');
              console.log('Current showAddAccountModal state:', showAddAccountModal);
              setShowAddAccountModal(true);
              console.log('Set showAddAccountModal to true');
            }}
            className="btn btn-outline flex items-center gap-1 text-sm"
            type="button"
          >
            <Plus size={14} />
            Add Account
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔘 Add Strategy button clicked!');
              console.log('Current showAddStrategyModal state:', showAddStrategyModal);
              setShowAddStrategyModal(true);
              console.log('Set showAddStrategyModal to true');
            }}
            className="btn btn-outline flex items-center gap-1 text-sm"
            type="button"
          >
            <Plus size={14} />
            Add Strategy
          </button>
        </div>
      </div>
    );
  };

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
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-semibold mb-4">Known Accounts</h3>
            <AccountListWithProfiles 
              accounts={getSortedAccounts()} 
              onDeleteAccount={handleDeleteAccount} 
              isAdmin={isAdmin} 
              ranks={ranks}
              handleUpdateRank={handleUpdateRank}
              isUpdatingRank={isUpdatingRank}
            />
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
                (playerData.teammates as any)?.map((teammate: any) => {
                  const accountCount = teammate.teammate.accounts?.length || 0;
                  const hasMultipleAccounts = accountCount > 1;

                  // Find the best account to display (online first, then any account)
                  const onlineAccount = teammate.teammate.accounts?.find((acc: any) => 
                    acc.status?.isOnline === true
                  );
                  const anyAccount = teammate.teammate.accounts?.[0];
                  const displayAccount = onlineAccount || anyAccount;
                  
                  console.log('🔍 Main teammate status debug:', {
                    alias: teammate.teammate.alias,
                    accounts: teammate.teammate.accounts?.length || 0,
                    hasStatus: !!displayAccount?.status,
                    isOnline: displayAccount?.status?.isOnline,
                    username: displayAccount?.status?.username
                  });
                  
                  let statusText = 'Offline';
                  let statusColor = 'text-gray-400';
                  
                  if (displayAccount?.status?.isOnline) {
                    if (displayAccount.status.inBedwars) {
                      statusText = 'Online - In BedWars';
                      statusColor = 'text-blue-600 dark:text-blue-400';
                    } else {
                      statusText = 'Online';
                      statusColor = 'text-green-600 dark:text-green-400';
                    }
                  }
                  
                  // Don't show players who are already teammates
                  const isNotCurrentTeammate = !(playerData.teammates as any)?.some((pt: any) => 
                    pt.teammate.id === teammate.id
                  );
                  
                  return (
                    <div 
                      key={teammate.teammate.id}
                      className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                      onClick={() => handleTeammateNavigation(teammate.teammate.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{teammate.teammate.alias}</span>
                          {displayAccount?.status?.username && (
                            <span className="text-sm text-gray-500">
                              ({displayAccount.status.username})
                            </span>
                          )}
                          {hasMultipleAccounts && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                              <Users size={12} />
                              {accountCount}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${statusColor}`}>
                            {statusText}
                          </span>
                          <ChevronRight size={18} className="text-gray-400" />
                        </div>
                      </div>
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        // Only close if clicking the overlay, not the modal content
        if (e.target === e.currentTarget) {
          setShowAddAccountModal(false);
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => {
          // Prevent clicks inside modal from bubbling up
          e.stopPropagation();
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Account</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddAccountModal(false);
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Roblox User ID
            </label>
            <input
              type="number"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Enter Roblox User ID"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddAccountModal(false);
              }}
              className="btn btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddAccount();
              }}
              className="btn btn-primary flex-1"
            >
              Add Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddStrategyModal = () => (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => {
        // Only close if clicking the overlay, not the modal content
        if (e.target === e.currentTarget) {
          setShowAddStrategyModal(false);
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-5xl shadow-2xl max-h-[95vh] overflow-y-auto"
        style={{
          minWidth: 'min(800px, 90vw)',
          minHeight: 'min(600px, 80vh)'
        }}
        onClick={(e) => {
          // Prevent clicks inside modal from bubbling up
          e.stopPropagation();
        }}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Add Strategy</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddStrategyModal(false);
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>

          {/* Image URL Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="https://example.com/strategy-image.png"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            />
          </div>

          {/* Kit Selection Section with More Space */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium">Select 5 Kits</label>
              <span className="text-sm text-gray-500">
                {selectedKits.length}/5 selected
              </span>
            </div>
            
            {/* Search bar */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search kits..."
                value={kitSearchQuery}
                onChange={(e) => setKitSearchQuery(e.target.value)}
                className="w-full p-3 pl-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
              />
              <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
            </div>

            {/* Kit grid with better spacing */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6 min-h-[400px] max-h-[500px] overflow-y-auto">
              {displayKits.map(kit => {
                if (!kit) return null;
                const isSelected = selectedKits.includes(kit.id);
                const isStarred = starredKitId === kit.id;
                
                return (
                  <div
                    key={kit.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        setSelectedKits(prev => prev.filter(id => id !== kit.id));
                        if (isStarred) {
                          setStarredKitId(null);
                        }
                      } else if (selectedKits.length < 5) {
                        setSelectedKits(prev => [...prev, kit.id]);
                      }
                    }}
                    className={`kit-card ${
                      isSelected ? 'kit-selected' : ''
                    } ${
                      isSelected 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                        : 'bg-white dark:bg-gray-800'
                    } border ${
                      isSelected 
                        ? 'border-yellow-400' 
                        : 'border-gray-200 dark:border-gray-700'
                    } relative group p-2`}
                  >
                    {/* Kit image */}
                    <div className="aspect-square mb-2">
                      <img
                        src={kit.image_url}
                        alt={kit.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    
                    {/* Kit name */}
                    <div className={`text-center text-xs font-medium ${
                      isSelected ? 'text-yellow-800 dark:text-yellow-200' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kit.name}
                    </div>
                    
                    {/* Enhanced star icon */}
                    {isSelected && (
                      <EnhancedStarIcon isStarred={isStarred} onClick={(e) => {
                        e.stopPropagation();
                        setStarredKitId(isStarred ? null : kit.id);
                      }} />
                    )}
                    
                    {/* Selection indicator overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-yellow-500/10 pointer-events-none rounded-lg" />
                    )}
                    
                    {/* Starred kit indicator */}
                    {isStarred && (
                      <div className="absolute top-0 left-0 bg-yellow-400 text-black text-xs px-2 py-1 rounded-br-lg font-bold shadow-lg">
                        MAIN
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Star instruction */}
            <div className="text-sm text-gray-500 font-medium flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <Star size={16} className="text-yellow-400" fill="currentColor" />
              Important: Star the kit that {player.alias} uses in this strategy
            </div>
          </div>

          {commonKits.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Commonly Used Kits:</h4>
              <div className="flex gap-2">
                {commonKits.map(({ kit, count }) => (
                  <div key={kit?.id} className="relative">
                    {kit && <KitCard kit={kit} size="sm" />}
                    <div className="absolute -top-2 -right-2 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddStrategyModal(false);
              }}
              className="btn btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddStrategy();
              }}
              className="btn btn-primary flex-1"
              disabled={selectedKits.length !== 5 || !starredKitId}
            >
              Add Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRankClaimModal = () => (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowRankClaimModal(false);
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Submit Rank Update</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRankClaimModal(false);
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            >
              <option value="" className="dark:bg-gray-700 dark:text-gray-100">
                Select account...
              </option>
              {playerData.accounts?.map(account => (
                <option 
                  key={account.id} 
                  value={account.id}
                  className="dark:bg-gray-700 dark:text-gray-100"
                >
                  {account.status?.username || `User ${account.user_id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              New Rank
            </label>
            <select
              value={selectedRankId}
              onChange={(e) => setSelectedRankId(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              disabled={!selectedAccountId}
            >
              <option value="" className="dark:bg-gray-700 dark:text-gray-100">
                Select rank...
              </option>
              {ranks.map(rank => (
                <option 
                  key={rank.id} 
                  value={rank.id}
                  className="dark:bg-gray-700 dark:text-gray-100"
                >
                  {rank.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Proof URL (Screenshot/Video)
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="https://example.com/proof.png"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRankClaimModal(false);
              }}
              className="btn btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSubmitRankClaim();
              }}
              className="btn btn-primary flex-1 flex items-center gap-2"
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
    const filteredTeammates = availableTeammates.filter(teammate => {
      const searchLower = teammateSearchQuery.toLowerCase().trim();
      
      // Search by player alias
      const matchesAlias = teammate.alias.toLowerCase().includes(searchLower);
      
      // Search by any account username
      const matchesUsername = teammate.accounts?.some(account => 
        account.status?.username?.toLowerCase().includes(searchLower)
      );
      
      // Don't show players who are already teammates
      const isNotCurrentTeammate = !(playerData.teammates as any)?.some((pt: any) => 
        pt.teammate.id === teammate.id
      );
      
      return (matchesAlias || matchesUsername) && isNotCurrentTeammate;
    });

    console.log('🔍 Teammate modal debug:', {
      availableTeammates: availableTeammates.length,
      filteredTeammates: filteredTeammates.length,
      currentTeammates: playerData.teammates?.length || 0,
      searchQuery: teammateSearchQuery
    });

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowTeammateModal(false);
          }
        }}
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Manage Teammates</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTeammateModal(false);
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search players by alias or Roblox username..."
                value={teammateSearchQuery}
                onChange={(e) => setTeammateSearchQuery(e.target.value)}
                className="w-full p-3 pl-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
              />
              <Search size={18} className="absolute left-3 top-3.5 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Current Teammates</h4>
                {playerData.teammates?.length === 0 ? (
                  <p className="text-gray-500 text-sm">No teammates added yet.</p>
                ) : (
                  <div className={`space-y-2 ${(playerData.teammates?.length || 0) > 4 ? 'max-h-40 overflow-y-auto pr-2' : ''}`}>
                    {(playerData.teammates as any)?.map((teammate: any) => {
                      const accountCount = teammate.teammate.accounts?.length || 0;
                      const hasMultipleAccounts = accountCount > 1;

                      // Find the best account to display (online first, then any account)
                      const onlineAccount = teammate.teammate.accounts?.find((acc: any) => 
                        acc.status?.isOnline === true
                      );
                      const anyAccount = teammate.teammate.accounts?.[0];
                      const displayAccount = onlineAccount || anyAccount;
                      
                      console.log('🔍 Current teammate status debug:', {
                        alias: teammate.teammate.alias,
                        accounts: teammate.teammate.accounts?.length || 0,
                        hasStatus: !!displayAccount?.status,
                        isOnline: displayAccount?.status?.isOnline,
                        username: displayAccount?.status?.username
                      });
                      
                      let statusText = 'Offline';
                      let statusColor = 'text-gray-400';
                      
                      if (displayAccount?.status?.isOnline) {
                        if (displayAccount.status.inBedwars) {
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
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{teammate.teammate.alias}</span>
                              <button
                                onClick={() => handleRemoveTeammate(teammate.teammate.id)}
                                className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                                title="Remove teammate"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            
                            {/* Show teammate's status */}
                            {displayAccount?.status ? (
                              <div className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${
                                  displayAccount.status.isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {displayAccount.status.isOnline ? (
                                    displayAccount.status.inBedwars ? 'In Bedwars' : 'Online'
                                  ) : 'Offline'}
                                </span>
                                {displayAccount.status.username && (
                                  <span className="font-mono text-blue-600 dark:text-blue-400">
                                    {displayAccount.status.username}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">No status data</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Available Players</h4>
                {filteredTeammates.length === 0 ? (
                  <p className="text-gray-500 text-sm">No available players found.</p>
                ) : (
                  <div className={`space-y-2 ${filteredTeammates.length > 6 ? 'max-h-60 overflow-y-auto pr-2' : ''}`}>
                    {filteredTeammates.map(teammate => {
                      const accountCount = teammate.accounts?.length || 0;
                      const hasMultipleAccounts = accountCount > 1;

                      // Find the best account to display (online first, then any account)
                      const onlineAccount = teammate.accounts?.find(acc => 
                        acc.status?.isOnline === true
                      );
                      const anyAccount = teammate.accounts?.[0];
                      const displayAccount = onlineAccount || anyAccount;
                      
                      return (
                        <div
                          key={teammate.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{teammate.alias}</span>
                              <button
                                onClick={() => handleAddTeammate(teammate.id)}
                                className="text-green-600 hover:text-green-700 p-1 flex-shrink-0"
                                title="Add as teammate"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                            
                            {/* Show available player's status */}
                            {displayAccount?.status ? (
                              <div className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${
                                  displayAccount.status.isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {displayAccount.status.isOnline ? (
                                    displayAccount.status.inBedwars ? 'In Bedwars' : 'Online'
                                  ) : 'Offline'}
                                </span>
                                {displayAccount.status.username && (
                                  <span className="font-mono text-blue-600 dark:text-blue-400">
                                    {displayAccount.status.username}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">No status data</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        // Only close if clicking the overlay, not the modal content
        if (e.target === e.currentTarget) {
          setShowEditModal(false);
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => {
          // Prevent clicks inside modal from bubbling up
          e.stopPropagation();
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Edit Player
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEditModal(false);
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Player Alias
            </label>
            <input
              type="text"
              value={editingAlias}
              onChange={(e) => setEditingAlias(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Enter player alias"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              YouTube Channel URL
            </label>
            <input
              type="url"
              value={editingYoutubeChannel}
              onChange={(e) => setEditingYoutubeChannel(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="https://youtube.com/@channel"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              autoComplete="off"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(false);
              }}
              className="btn btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditPlayer();
              }}
              className="btn btn-primary flex-1 flex items-center gap-2"
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <>
        {renderModal()}
        {showTeammateModal && renderTeammateModal()}
        {showAddAccountModal && (() => {
          console.log('🎭 Rendering Add Account Modal');
          return renderAddAccountModal();
        })()}
        {showAddStrategyModal && (() => {
          console.log('🎭 Rendering Add Strategy Modal');
          return renderAddStrategyModal();
        })()}
        {showRankClaimModal && renderRankClaimModal()}
        {showEditModal && renderEditModal()}
      </>
    );
  }

  return (
    <>
      {renderCard()}
      {showTeammateModal && renderTeammateModal()}
      {showAddAccountModal && (() => {
        console.log('🎭 Rendering Add Account Modal');
        return renderAddAccountModal();
      })()}
      {showAddStrategyModal && (() => {
        console.log('🎭 Rendering Add Strategy Modal');
        return renderAddStrategyModal();
      })()}
      {showRankClaimModal && renderRankClaimModal()}
      {showEditModal && renderEditModal()}
    </>
  );
}

export default PlayerCard;
