import { useState, useEffect } from 'react';
import { Player, PlayerAccount } from '../types/players';
import { supabase } from '../lib/supabase';

export function usePlayerData(player: Player) {
  const [playerData, setPlayerData] = useState<Player>(player);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshPlayerData = async () => {
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
        .eq('id', player.id)
        .single();

      if (error) throw error;
      if (data) {
        setPlayerData(data);
      }
    } catch (error) {
      console.error('Error refreshing player data:', error);
      setError('Failed to refresh player data');
    }
  };

  const getAccountRank = (account: PlayerAccount) => {
    if (!account.rank?.account_ranks) return null;
    return account.rank.account_ranks;
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

  const handleEditPlayer = async (alias: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ alias: alias.trim() })
        .eq('id', player.id);

      if (error) throw error;
      await refreshPlayerData();
      setSuccess('Player updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating player:', error);
      setError('Failed to update player');
      return false;
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

  return {
    playerData,
    error,
    success,
    refreshPlayerData,
    getAccountRank,
    handleDeleteAccount,
    handleDeleteStrategy,
    handleEditPlayer,
    handleAddTeammate,
    handleRemoveTeammate,
    setError,
    setSuccess
  };
}