import React, { useState, useEffect } from 'react';
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
import { usePlayerStore } from '../../store/playerStore';

interface PlayerCardProps {
  player: Player;
  onDelete?: (playerId: string) => void;
  isAdmin?: boolean;
}

function PlayerCard({ player, onDelete, isAdmin }: PlayerCardProps) {
  const { user } = useAuth();
  const { kits } = useKits();
  const { restrictedIds } = useRestrictedUserIds();
  const { refreshPlayer } = usePlayerStore();

  const [showModal, setShowModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddStrategyModal, setShowAddStrategyModal] = useState(false);
  const [showRankClaimModal, setShowRankClaimModal] = useState(false);
  const [showTeammateModal, setShowTeammateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!player.accounts) return;
    const seen = new Set();
    const toDelete: string[] = [];
    player.accounts.forEach(acc => {
      const userIdStr = String(acc.user_id);
      // Remove if restricted
      if (restrictedIds.some(rid => String(rid).trim() === userIdStr)) {
        toDelete.push(acc.id);
        return;
      }
      // Remove duplicates (keep first occurrence)
      if (seen.has(userIdStr)) {
        toDelete.push(acc.id);
      } else {
        seen.add(userIdStr);
      }
    });
    if (toDelete.length > 0) {
      Promise.all(
        toDelete.map(id =>
          supabase.from('player_accounts').delete().eq('id', id)
        )
      ).then(() => {
        refreshPlayer(player.id);
      });
    }
  }, [player.accounts, restrictedIds, player.id, refreshPlayer]);

  const getCommonKits = () => {
    const kitUsage = new Map<string, number>();
    player.strategies?.forEach(strategy => {
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

  if (!user) return null;

  return (
    <>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 space-y-6"
        onClick={() => setShowModal(true)}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">{player.alias}</h3>
            <div className="space-y-3 mt-4">
              {player.accounts?.map(account => (
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
                        await supabase.from('player_accounts').delete().eq('id', account.id);
                        refreshPlayer(player.id);
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
          {player.strategies?.slice(0, 3).map(strategy => (
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
          player={player}
          onClose={() => setShowModal(false)}
          onShowRankClaim={() => setShowRankClaimModal(true)}
          onShowTeammates={() => setShowTeammateModal(true)}
          // onDeleteStrategy={handleDeleteStrategy} // implement as needed
          isAdmin={isAdmin}
        />
      )}

      {showAddAccountModal && (
        <AddAccountModal
          key={restrictedIds.join(',')}
          player={player}
          onClose={() => setShowAddAccountModal(false)}
          onSuccess={() => refreshPlayer(player.id)}
        />
      )}

      {showAddStrategyModal && (
        <AddStrategyModal
          player={player}
          onClose={() => setShowAddStrategyModal(false)}
          onSuccess={() => refreshPlayer(player.id)}
        />
      )}

      {showRankClaimModal && (
        <RankClaimModal
          player={player}
          onClose={() => setShowRankClaimModal(false)}
          onSuccess={() => refreshPlayer(player.id)}
        />
      )}

      {showTeammateModal && (
        <TeammateModal
          player={player}
          onClose={() => setShowTeammateModal(false)}
          // onAddTeammate={handleAddTeammate} // implement as needed
          // onRemoveTeammate={handleRemoveTeammate} // implement as needed
        />
      )}

      {showEditModal && (
        <EditPlayerModal
          player={player}
          onClose={() => setShowEditModal(false)}
          // onSave={handleEditPlayer} // implement as needed
        />
      )}
    </>
  );
}

export default PlayerCard;