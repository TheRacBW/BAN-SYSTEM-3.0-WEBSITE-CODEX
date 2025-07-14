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
        }, 300);
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
        />
      )}

      {showAddAccountModal && (
        <AddAccountModal
          key={restrictedIds.join(',')}
          player={livePlayer}
          onClose={() => setShowAddAccountModal(false)}
          onSuccess={() => {
            setTimeout(() => {
              refetch();
              if (onAccountChange) onAccountChange();
            }, 300);
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