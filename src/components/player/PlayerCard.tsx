import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Player } from '../../types/players';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2, Plus, Star } from 'lucide-react';
import RobloxStatus from '../RobloxStatus';
import KitCard from '../KitCard';
import PlayerModal from './PlayerModal';
import AddAccountModal from './modals/AddAccountModal';
import AddStrategyModal from './modals/AddStrategyModal';
import RankClaimModal from './modals/RankClaimModal';
import TeammateModal from './modals/TeammateModal';
import EditPlayerModal from './modals/EditPlayerModal';
import { useKits } from '../../context/KitContext';
import { useRestrictedUserIds } from '../../hooks/useRestrictedUserIds';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

// --- Safe Roblox Profile Integration ---
interface RobloxProfile {
  username: string;
  user_id: number;
  profile_picture_url: string | null;
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
            ...profile,
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
              profile_picture_url: null,
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
  showLink = true,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  const getProfilePictureUrl = () => {
    if (profile?.profile_picture_url && !imageError) {
      return profile.profile_picture_url;
    }
    if (profile?.user_id) {
      return `https://www.roblox.com/headshot-thumbnail/image?userId=${profile.user_id}&width=150&height=150&format=png`;
    }
    return null;
  };
  const ProfileImage = () => (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-gray-300 dark:border-gray-600 ${className}`}>
      {getProfilePictureUrl() ? (
        <img
          src={getProfilePictureUrl()}
          alt={`${username}'s Roblox avatar`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="text-gray-400 text-xs font-bold flex items-center justify-center">
          {username.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
  if (showLink && profile?.user_id) {
    return (
      <a
        href={`https://www.roblox.com/users/${profile.user_id}/profile`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity hover:scale-105 transform duration-200"
        title={`View ${username}'s Roblox profile (ID: ${profile.user_id})`}
      >
        <ProfileImage />
      </a>
    );
  }
  return <ProfileImage />;
};

const AccountListWithProfiles = ({ accounts, onDeleteAccount }: { 
  accounts: any[], 
  onDeleteAccount: (accountId: string) => void 
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
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {accounts.map((account) => {
          const profile = profiles.get(account.username);
          return (
            <div
              key={account.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <RobloxProfilePicture
                username={account.username}
                profile={profile}
                size="sm"
                showLink={true}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {account.username}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {profile?.user_id && (
                    <span>ID: {profile.user_id}</span>
                  )}
                  {profile?.source && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      profile.source === 'cache' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    }`}>
                      {profile.source}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full" title="Status unknown"></div>
                <button
                  onClick={() => onDeleteAccount(account.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete account"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
// --- End Safe Roblox Profile Integration ---

interface PlayerCardProps {
  player: Player;
  onDelete?: (playerId: string) => void;
  isAdmin?: boolean;
  onAccountChange?: () => void; // <-- Add this
}

async function fetchPlayer(playerId: string) {
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
        ),
        status,
        created_at
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
  if (error) throw error;
  return data;
}

function PlayerCard({ player, onDelete, isAdmin, onAccountChange }: PlayerCardProps) {
  const { user } = useAuth();
  const { kits } = useKits();
  const { restrictedIds } = useRestrictedUserIds();
  const queryClient = useQueryClient();

  // Fetch player data live
  const { data: livePlayer, isLoading, refetch } = useQuery(['player', player.id], () => fetchPlayer(player.id), {
    refetchInterval: 5000, // Poll every 5 seconds for live updates
    initialData: player,
  });

  // Mutation for deleting an account
  const deleteAccountMutation = useMutation(
    async (accountId: string) => {
      await supabase.from('player_accounts').delete().eq('id', accountId);
    },
    {
      onSuccess: async () => {
        setTimeout(() => {
          refetch();
          if (onAccountChange) onAccountChange();
        }, 100); // Reduce delay for more instant update
      },
    }
  );

  const [showModal, setShowModal] = React.useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = React.useState(false);
  const [showAddStrategyModal, setShowAddStrategyModal] = React.useState(false);
  const [showRankClaimModal, setShowRankClaimModal] = React.useState(false);
  const [showTeammateModal, setShowTeammateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);

  React.useEffect(() => {
    console.log('Live player data:', livePlayer);
  }, [livePlayer]);

  const getCommonKits = () => {
    const kitUsage = new Map<string, number>();
    livePlayer?.strategies?.forEach(strategy => {
      strategy.kit_ids?.forEach(kitId => {
        const count = kitUsage.get(kitId) || 0;
        kitUsage.set(kitId, count + 1);
      });
    });
    return Array.from(kitUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kitId, count]) => ({
        kit: kits.find(k => k.id === kitId)!,
        count
      }))
      .filter(item => item.kit);
  };

  const getAccountRank = (account: any) => {
    if (!account.rank || !Array.isArray(account.rank) || account.rank.length === 0) return null;
    return account.rank[0].account_ranks;
  };

  if (!user || !livePlayer) return null;

  return (
    <>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 space-y-6"
        onClick={() => setShowModal(true)}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">{livePlayer.alias}</h3>
            <div className="space-y-3 mt-4">
              {livePlayer.accounts?.map(account => (
                <div key={account.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg">
                  {account.status && (
                    <RobloxStatus
                      username={account.status.username}
                      isOnline={account.status.isOnline}
                      isInGame={account.status.isInGame}
                      inBedwars={account.status.inBedwars}
                      lastUpdated={account.status.lastUpdated}
                    />
                  )}
                  {getAccountRank(account) && (
                    <img 
                      src={getAccountRank(account)?.image_url} 
                      alt={getAccountRank(account)?.name}
                      className="w-6 h-6 drop-shadow-md"
                      title={getAccountRank(account)?.name}
                    />
                  )}
                  {isAdmin && (
                    <button
                      className="ml-2 p-1 text-red-600 hover:bg-red-100 rounded-full"
                      title="Delete Account"
                      onClick={async (e) => {
                        e.stopPropagation();
                        deleteAccountMutation.mutate(account.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
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

        <div className="mb-8">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Star size={16} className="text-yellow-500" fill="currentColor" />
            Most Used Kits
          </h4>
          <div className="flex gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
            {getCommonKits().map(({ kit, count }) => (
              <div key={kit.id} className="relative flex-shrink-0">
                <KitCard kit={kit} size="sm" />
                <div className="absolute -top-2 -right-2 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {livePlayer.strategies?.slice(0, 3).map(strategy => (
            strategy.kit_ids?.slice(0, 3).map(kitId => {
              const kit = kits.find(k => k.id === kitId);
              if (!kit) return null;
              return (
                <div key={kitId} className="w-8 h-8 flex-shrink-0">
                  <KitCard kit={kit} size="sm" showDetails={false} />
                </div>
              );
            })
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddAccountModal(true);
            }}
            className="btn btn-outline flex items-center gap-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Plus size={14} />
            Add Account
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddStrategyModal(true);
            }}
            className="btn btn-outline flex items-center gap-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Plus size={14} />
            Add Strategy
          </button>
        </div>
      </div>

      {showModal && (
        <PlayerModal 
          player={livePlayer}
          onClose={() => setShowModal(false)}
          onShowRankClaim={() => setShowRankClaimModal(true)}
          onShowTeammates={() => setShowTeammateModal(true)}
          isAdmin={isAdmin}
          // Add enhanced accounts section
          accountsSection={
            <AccountListWithProfiles 
              accounts={livePlayer.accounts || []} 
              onDeleteAccount={deleteAccountMutation.mutate} 
            />
          }
        />
      )}

      {showAddAccountModal && (
        <AddAccountModal
          key={restrictedIds.join(',')}
          player={livePlayer}
          onClose={() => setShowAddAccountModal(false)}
          onSuccess={() => {
            setTimeout(() => {
              refetch(); // force: true is not a standard option, but this ensures a fresh fetch
              if (onAccountChange) onAccountChange();
            }, 100); // Reduce delay for more instant update
          }}
        />
      )}

      {showAddStrategyModal && (
        <AddStrategyModal
          player={livePlayer}
          onClose={() => setShowAddStrategyModal(false)}
          onSuccess={() => refetch()}
        />
      )}

      {showRankClaimModal && (
        <RankClaimModal
          player={livePlayer}
          onClose={() => setShowRankClaimModal(false)}
          onSuccess={() => refetch()}
        />
      )}

      {showTeammateModal && (
        <TeammateModal
          player={livePlayer}
          onClose={() => setShowTeammateModal(false)}
        />
      )}

      {showEditModal && (
        <EditPlayerModal
          player={livePlayer}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
}

export default PlayerCard;