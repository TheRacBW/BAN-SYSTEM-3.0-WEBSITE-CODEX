import { Kit } from './index';

export interface Player {
  id: string;
  created_by: string;
  alias: string;
  created_at: Date;
  updated_at: Date;
  youtube_channel?: string;
  accounts?: PlayerAccount[];
  teammates?: Player[];
  strategies?: PlayerStrategy[];
}

export interface PlayerAccount {
  id: string;
  player_id: string;
  user_id: number;
  created_at: Date;
  rank?: AccountRank;
  status?: {
    isOnline: boolean;
    inBedwars: boolean;
    placeId?: string;
    universeId?: string;
    username: string;
    lastUpdated: number;
  };
}

export interface PlayerStrategy {
  id: string;
  player_id: string;
  image_url: string;
  kit_ids: string[];
  teammate_ids: string[];
  created_at: Date;
  kits?: Kit[];
  teammates?: Player[];
}

export interface AccountRank {
  id: string;
  name: string;
  image_url: string;
  created_at: Date;
}

export interface RankUpdateClaim {
  id: string;
  account_id: string;
  rank_id: string;
  proof_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

export type SortOption = 'alias_asc' | 'alias_desc' | 'online' | 'rank';

export const RANK_VALUES = {
  'Bronze': 1,
  'Silver': 2,
  'Gold': 3,
  'Platinum': 4,
  'Diamond': 5,
  'Emerald': 6,
  'Nightmare': 7
};