import React, { useState } from 'react';
import { Player } from '../../../types/players';
import { supabase } from '../../../lib/supabase';
import { X } from 'lucide-react';
import { useRestrictedUserIds } from '../../../hooks/useRestrictedUserIds';
import { useRef } from 'react';

interface AddAccountModalProps {
  player: Player;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAccountModal({ player, onClose, onSuccess }: AddAccountModalProps) {
  const [newUserId, setNewUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { restrictedIds, loading: restrictedLoading } = useRestrictedUserIds();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const showTemporaryError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  const handleAddAccount = async () => {
    if (!newUserId) {
      showTemporaryError('Please enter a Roblox User ID');
      return;
    }

    const normalizedInputId = String(newUserId).trim();

    // Check for restricted ID
    const isRestricted = restrictedIds.some(restrictedId => String(restrictedId).trim() === normalizedInputId);
    if (isRestricted) {
      showTemporaryError('This account cannot be added.');
      return;
    }

    // Check for duplicate in this player card
    const alreadyExists = player.accounts?.some(acc => String(acc.user_id) === normalizedInputId);
    if (alreadyExists) {
      showTemporaryError('This account is already added to this player.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('player_accounts')
        .insert({
          player_id: player.id,
          user_id: parseInt(newUserId)
        });

      if (error) {
        if (error.message && error.message.toLowerCase().includes('restricted')) {
          showTemporaryError('This account cannot be added.');
        } else {
          showTemporaryError('Failed to add account');
        }
        return; // Do NOT close the modal on error
      }

      onSuccess();
      onClose();
    } catch (error) {
      showTemporaryError('Failed to add account');
      console.error('Error adding account:', error);
      // Do NOT close the modal on error
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAccountDebounced = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      handleAddAccount();
    }, 500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const normalizedValue = String(value).trim();
    const isRestricted = restrictedIds.some(restrictedId => String(restrictedId).trim() === normalizedValue);
    if (isRestricted) {
      setNewUserId('');
      setError('This account cannot be added.');
      return;
    }
    setNewUserId(value);
    setError(null);
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
              onChange={handleInputChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              placeholder="Enter Roblox User ID"
              disabled={restrictedLoading}
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
              onClick={handleAddAccountDebounced}
              className="btn btn-primary"
              disabled={restrictedLoading || submitting}
            >
              Add Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}