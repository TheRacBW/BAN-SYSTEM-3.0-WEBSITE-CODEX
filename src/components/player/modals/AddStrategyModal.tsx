import React, { useState } from 'react';
import { Player } from '../../../types/players';
import { useKits } from '../../../context/KitContext';
import { supabase } from '../../../lib/supabase';
import { X, Search, Star } from 'lucide-react';
import KitCard from '../../KitCard';

interface AddStrategyModalProps {
  player: Player;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStrategyModal({ player, onClose, onSuccess }: AddStrategyModalProps) {
  const { kits } = useKits();
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [starredKitId, setStarredKitId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [kitSearchQuery, setKitSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filteredKits = kits.filter(kit => 
    kit.name.toLowerCase().includes(kitSearchQuery.toLowerCase())
  );

  const displayKits = filteredKits.slice(0, 8);

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
      const { error } = await supabase
        .from('player_strategies')
        .insert({
          player_id: player.id,
          image_url: imageUrl,
          kit_ids: selectedKits,
          starred_kit_id: starredKitId
        });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding strategy:', error);
      setError('Failed to add strategy');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Add Strategy</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select 5 Kits</label>
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
                  className={`relative cursor-pointer rounded-xl overflow-hidden transition-all transform hover:scale-105 hover:shadow-lg ${
                    selectedKits.includes(kit.id) 
                      ? 'ring-4 ring-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] transition-shadow bg-blue-100/10 dark:bg-blue-900/20' 
                      : ''
                  } ${
                    starredKitId === kit.id
                      ? 'shadow-[0_0_35px_rgba(234,179,8,0.6)] hover:shadow-[0_0_45px_rgba(234,179,8,0.7)] bg-yellow-100/30 dark:bg-yellow-900/40'
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
                      className={`absolute top-2 right-2 p-3 rounded-full transform scale-[2.2] transition-all hover:scale-[2.4] hover:rotate-12 hover:shadow-lg ${
                        starredKitId === kit.id
                          ? 'text-yellow-400 bg-yellow-100/40 shadow-lg shadow-yellow-500/50 animate-pulse hover:shadow-yellow-500/60'
                          : 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-100/30 dark:hover:bg-yellow-900/30 hover:shadow-yellow-500/30'
                      }`}
                      title={starredKitId === kit.id ? 'Unstar kit' : 'Star this kit to indicate it is used by the player'}
                    >
                      <Star 
                        size={22} 
                        className="drop-shadow-lg filter drop-shadow-[0_4px_6px_rgba(234,179,8,0.6)] hover:drop-shadow-[0_6px_8px_rgba(234,179,8,0.7)]" 
                        fill={starredKitId === kit.id ? 'currentColor' : 'none'} 
                        strokeWidth={starredKitId === kit.id ? 2.5 : 2}
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-yellow-500 dark:text-yellow-400 mt-6 font-medium flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <Star size={16} className="text-yellow-400" fill="currentColor" /> Important: Star the kit that {player.alias} uses in this strategy
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button onClick={handleAddStrategy} className="btn btn-primary">
              Add Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}