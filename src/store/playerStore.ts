import { create } from 'zustand';
import { Player } from '../types/players';
import { supabase } from '../lib/supabase';

interface PlayerStoreState {
  players: Player[];
  loading: boolean;
  error: string | null;
  fetchAllPlayers: () => Promise<void>;
  fetchPlayerById: (id: string) => Promise<Player | undefined>;
  refreshPlayer: (id: string) => Promise<void>;
  refreshAllPlayers: () => Promise<void>;
  addPlayer: (player: Player) => void;
  updatePlayer: (player: Player) => void;
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
    set({ players: data || [], loading: false });
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
    // Update or add the player in the store
    const players = get().players.filter((p: Player) => p.id !== id);
    set({ players: [...players, data], loading: false });
    return data;
  },

  refreshPlayer: async (id: string) => {
    await get().fetchPlayerById(id);
  },

  refreshAllPlayers: async () => {
    await get().fetchAllPlayers();
  },

  addPlayer: (player: Player) => {
    set((state) => ({ players: [...state.players, player] }));
  },

  updatePlayer: (player: Player) => {
    set((state) => ({
      players: state.players.map((p: Player) => (p.id === player.id ? player : p)),
    }));
  },

  removePlayer: (id: string) => {
    set((state) => ({ players: state.players.filter((p: Player) => p.id !== id) }));
  },
})); 