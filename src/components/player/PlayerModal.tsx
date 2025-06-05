import React, { useState } from 'react';
import { Player } from '../../types/players';
import { X, Users, Shield, Image, Maximize2, Trash2 } from 'lucide-react';
import KitCard from '../KitCard';
import RobloxStatus from '../RobloxStatus';
import { useKits } from '../../context/KitContext';

interface PlayerModalProps {
  player: Player;
  onClose: () => void;
  onShowRankClaim: () => void;
  onShowTeammates: () => void;
  onDeleteStrategy: (id: string) => void;
  isAdmin?: boolean;
}

export default function PlayerModal({ 
  player, 
  onClose, 
  onShowRankClaim,
  onShowTeammates,
  onDeleteStrategy,
  isAdmin 
}: PlayerModalProps) {
  const { kits } = useKits();
  const [showStrategyImages, setShowStrategyImages] = useState(true);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">{player.alias}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Users size={18} className="text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {player.teammates?.length || 0} Teammates
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
            <div className="space-y-4">
              {player.accounts?.map(account => (
                <div key={account.id} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <RobloxStatus userId={account.user_id} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Teammates</h3>
              <button
                onClick={onShowTeammates}
                className="btn btn-outline flex items-center gap-2"
              >
                <Users size={18} />
                Manage Teammates
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.teammates?.map(teammate => (
                <div key={teammate.teammate.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <span>{teammate.teammate.alias}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Strategies</h3>
              <button
                onClick={() => setShowStrategyImages(!showStrategyImages)}
                className="btn btn-outline flex items-center gap-2"
              >
                <Image size={18} />
                {showStrategyImages ? 'Hide Images' : 'Show Images'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.strategies?.map(strategy => (
                <div key={strategy.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  {showStrategyImages && (
                    <div className="relative mb-4">
                      <img
                        src={strategy.image_url}
                        alt="Strategy"
                        className="w-full h-32 object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setExpandedStrategyId(strategy.id)}
                      />
                      <button
                        className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                        onClick={() => setExpandedStrategyId(strategy.id)}
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
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => onDeleteStrategy(strategy.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-center">
            <button
              onClick={onShowRankClaim}
              className="btn btn-primary flex items-center gap-2"
            >
              <Shield size={18} />
              Submit Rank Update
            </button>
          </div>
        </div>

        {expandedStrategyId && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]">
            <div className="relative max-w-4xl w-full mx-4">
              <button
                onClick={() => setExpandedStrategyId(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300"
              >
                <X size={24} />
              </button>
              <img
                src={player.strategies?.find(s => s.id === expandedStrategyId)?.image_url}
                alt="Strategy"
                className="w-full h-auto rounded"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}