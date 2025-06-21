import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useUserPins() {
  const { user } = useAuth();
  const [pinnedPlayers, setPinnedPlayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Load user's pinned players
  const loadPinnedPlayers = async () => {
    if (!user) {
      setPinnedPlayers(new Set());
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_pins')
        .select('player_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading pinned players:', error);
        return;
      }

      const pinnedIds = new Set(data?.map(pin => pin.player_id) || []);
      setPinnedPlayers(pinnedIds);
    } catch (error) {
      console.error('Error loading pinned players:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle pin for a player
  const togglePin = async (playerId: string) => {
    if (!user) return;

    try {
      const isPinned = pinnedPlayers.has(playerId);
      
      if (isPinned) {
        // Remove pin
        const { error } = await supabase
          .from('user_pins')
          .delete()
          .eq('user_id', user.id)
          .eq('player_id', playerId);

        if (error) {
          console.error('Error removing pin:', error);
          return;
        }

        setPinnedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(playerId);
          return newSet;
        });
      } else {
        // Add pin
        const { error } = await supabase
          .from('user_pins')
          .insert({
            user_id: user.id,
            player_id: playerId
          });

        if (error) {
          console.error('Error adding pin:', error);
          return;
        }

        setPinnedPlayers(prev => new Set([...prev, playerId]));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Check if a player is pinned
  const isPinned = (playerId: string) => pinnedPlayers.has(playerId);

  // Load pinned players on mount and when user changes
  useEffect(() => {
    loadPinnedPlayers();
  }, [user]);

  return {
    pinnedPlayers,
    togglePin,
    isPinned,
    loading
  };
} 