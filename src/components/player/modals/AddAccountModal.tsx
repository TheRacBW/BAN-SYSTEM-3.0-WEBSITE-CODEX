import React, { useState } from 'react';
import { Player } from '../../../types/players';
import { supabase } from '../../../lib/supabase';
import { X } from 'lucide-react';

interface AddAccountModalProps {
  player: Player;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAccountModal({ player, onClose, onSuccess }: AddAccountModalProps) {
  const [newUserId, setNewUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddAccount = async () => {
    if (!newUserId) {
      setError('Please enter a Roblox User ID');
      return;
    }

    try {
      const { error } = await supabase
        .from('player_accounts')
        .insert({
          player_id: player.id,
          user_id: parseInt(newUserId)
        });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding account:', error);
      setError('Failed to add account');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Add Account</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
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
              onClick={onClose}
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
}