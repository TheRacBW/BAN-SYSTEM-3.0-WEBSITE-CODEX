export interface LeaderboardEntry {
  id?: string;
  username: string;
  rank_position: number;
  rp: number;
  rank_title: string;
  inserted_at: string;
  profile_picture?: string | null;
  user_id?: number | null;
}

export interface RPChange {
  id?: string;
  username: string;
  previous_rp: number;
  new_rp: number;
  rp_change: number;
  previous_rank: number;
  new_rank: number;
  rank_change: number;
  change_timestamp: string;
}

export interface LeaderboardStats {
  username: string;
  total_gain?: number;
  total_loss?: number;
  profile_picture?: string | null;
  user_id?: number | null;
}

export interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
}

export interface RobloxThumbnail {
  targetId: number;
  state: string;
  imageUrl: string;
}

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  hottestGainers: LeaderboardStats[];
  biggestLosers: LeaderboardStats[];
  lastUpdate: string;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  activeTab: 'main' | 'gainers' | 'losers';
}

export type TabType = 'main' | 'gainers' | 'losers'; 