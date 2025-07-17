import React, { useState, useRef } from 'react';
import { Player } from '../../../types/players';
import { supabase } from '../../../lib/supabase';
import { X, User, Hash } from 'lucide-react';
import { useRestrictedUserIds } from '../../../hooks/useRestrictedUserIds';

interface AddAccountModalProps {
  player: Player;
  onClose: () => void;
  onSuccess: (newAccount: any) => void;
}

export default function AddAccountModal({ player, onClose, onSuccess }: AddAccountModalProps) {
  const [newUserId, setNewUserId] = useState('');
  const [username, setUsername] = useState('');
  const [inputMode, setInputMode] = useState<'userId' | 'username'>('userId');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const { restrictedIds, loading: restrictedLoading } = useRestrictedUserIds();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const showTemporaryError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  // Username lookup function
  const fetchUserIdFromUsername = async (usernameInput: string): Promise<number | null> => {
    setUsernameLoading(true);
    setError(null);
    try {
      const res = await fetch('https://dhmenivfjwbywdutchdz.supabase.co/functions/v1/find-user-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput })
      });
      if (!res.ok) {
        if (res.status === 400) {
          showTemporaryError('Username is required');
        } else if (res.status === 404) {
          showTemporaryError('Username not found');
        } else if (res.status === 403) {
          showTemporaryError('This user is restricted and cannot be added');
        } else {
          showTemporaryError('Failed to look up username');
        }
        setUsernameLoading(false);
        return null;
      }
      const data = await res.json();
      setUsernameLoading(false);
      return data.user_id;
    } catch (e) {
      setUsernameLoading(false);
      showTemporaryError('Failed to look up username');
      return null;
    }
  };

  const handleAddAccount = async () => {
    let userIdToAdd = newUserId;
    if (inputMode === 'username') {
      if (!username) {
        showTemporaryError('Please enter a Roblox username');
        return;
      }
      setSubmitting(true);
      const lookedUpUserId = await fetchUserIdFromUsername(username.trim());
      setSubmitting(false);
      if (!lookedUpUserId) return;
      userIdToAdd = String(lookedUpUserId);
    } else {
      if (!newUserId) {
        showTemporaryError('Please enter a Roblox User ID');
        return;
      }
    }
    const normalizedInputId = String(userIdToAdd).trim();
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
          user_id: parseInt(userIdToAdd)
        });
      if (error) {
        if (error.message && error.message.toLowerCase().includes('restricted')) {
          showTemporaryError('This account cannot be added.');
        } else {
          showTemporaryError('Failed to add account');
        }
        return;
      }
      // Fetch the newly added account for optimistic update
      const { data: newAccount } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('player_id', player.id)
        .eq('user_id', parseInt(userIdToAdd))
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      onSuccess(newAccount);
      onClose();
    } catch (error) {
      showTemporaryError('Failed to add account');
      console.error('Error adding account:', error);
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
    if (inputMode === 'userId') {
      const normalizedValue = String(value).trim();
      const isRestricted = restrictedIds.some(restrictedId => String(restrictedId).trim() === normalizedValue);
      if (isRestricted) {
        setNewUserId('');
        setError('This account cannot be added.');
        return;
      }
      setNewUserId(value);
      setError(null);
    } else {
      setUsername(value);
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="bg-red-500 p-4 mb-4 rounded">
          <h1 className="text-white text-2xl text-center">🚨 TESTING FILE RESOLUTION 🚨</h1>
        </div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Add Account (DEBUG-v2.0-TOGGLE)</h3>
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
        {/* Toggle UI */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            className={`flex items-center gap-1 px-3 py-1 rounded border ${inputMode === 'userId' ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
            onClick={() => setInputMode('userId')}
            disabled={inputMode === 'userId'}
            type="button"
          >
            <Hash size={18} /> User ID
          </button>
          <button
            className={`flex items-center gap-1 px-3 py-1 rounded border ${inputMode === 'username' ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
            onClick={() => setInputMode('username')}
            disabled={inputMode === 'username'}
            type="button"
          >
            <User size={18} /> Username
          </button>
        </div>
        <div className="space-y-4">
          {inputMode === 'userId' ? (
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
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">
                Roblox Username
              </label>
              <input
                type="text"
                value={username}
                onChange={handleInputChange}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="Enter Roblox Username"
                disabled={restrictedLoading || usernameLoading}
              />
            </div>
          )}
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
              disabled={restrictedLoading || submitting || usernameLoading}
            >
              {submitting || usernameLoading ? 'Adding...' : 'Add Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}