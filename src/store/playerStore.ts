import { create } from 'zustand';
import { Player } from '../types/players';
import { supabase } from '../lib/supabase';

interface PlayerWithTimestamp extends Player {
  lastUpdated?: number;
}

interface PlayerStoreState {
  players: PlayerWithTimestamp[];
  loading: boolean;
  error: string | null;
  fetchAllPlayers: () => Promise<void>;
  fetchPlayerById: (id: string) => Promise<PlayerWithTimestamp | undefined>;
  refreshPlayer: (id: string) => Promise<void>;
  refreshAllPlayers: () => Promise<void>;
  addPlayer: (player: PlayerWithTimestamp) => void;
  updatePlayer: (player: PlayerWithTimestamp) => void;
  removePlayer: (id: string) => void;
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  players: [],
  loading: false,
  error: null,

  fetchAllPlayers: async () => {
    set({ loading: true, error: null });
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
      `);
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    // Add lastUpdated to all players
    set({ players: (data || []).map((p: Player) => ({ ...p, lastUpdated: Date.now() })), loading: false });
  },

  fetchPlayerById: async (id: string) => {
    set({ loading: true, error: null });
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
      .eq('id', id)
      .single();
    if (error) {
      set({ error: error.message, loading: false });
      return undefined;
    }
    // Log the fetched player data
    console.log('Fetched player from Supabase:', data);
    // Always replace the player in the array with a new object reference and update lastUpdated
    set(state => {
      const idx = state.players.findIndex((p: PlayerWithTimestamp) => p.id === data.id);
      let newPlayers;
      const updatedPlayer = { ...data, lastUpdated: Date.now() };
      if (idx !== -1) {
        newPlayers = [...state.players];
        newPlayers[idx] = updatedPlayer;
      } else {
        newPlayers = [...state.players, updatedPlayer];
      }
      return {
        players: newPlayers,
        loading: false
      };
    });
    return { ...data, lastUpdated: Date.now() };
  },

  refreshPlayer: async (id: string) => {
    await get().fetchPlayerById(id);
  },

  refreshAllPlayers: async () => {
    await get().fetchAllPlayers();
  },

  addPlayer: (player: PlayerWithTimestamp) => {
    set((state) => ({ players: [...state.players, { ...player, lastUpdated: Date.now() }] }));
  },

  updatePlayer: (player: PlayerWithTimestamp) => {
    set((state) => ({
      players: state.players.map((p: PlayerWithTimestamp) => (p.id === player.id ? { ...player, lastUpdated: Date.now() } : p)),
    }));
  },

  removePlayer: (id: string) => {
    set((state) => ({ players: state.players.filter((p: PlayerWithTimestamp) => p.id !== id) }));
  },
})); 