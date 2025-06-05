export type KitType = 'Fighter' | 'Movement' | 'Economy' | 'Ranged' | 'Support' | 'Destroyer' | 'Tank' | 'Defender';

export interface Kit {
  id: string;
  name: string;
  imageUrl: string;
  image_url?: string;
  type: KitType;
  payLocked?: boolean;
  battlePass?: string;
}

export type StrategyTag = 'Rush' | 'Late' | 'Eco' | 'Troll';

export interface StrategyTags {
  tags: StrategyTag[];
  isActive: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  kits: string[];
  winRate: number;
  popularity: number;
  effectiveness: number;
  counterability: number;
  createdBy: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  user_id?: string;
  tags?: StrategyTag[];
  isActive?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  ownedKits: string[];
  favoriteKits: string[];
  favoriteStrategies: string[];
  isAdmin: boolean;
}

export interface BanState {
  teamA: string[];
  teamB: string[];
}

export interface KitReplacement {
  originalKit: Kit;
  replacements: {
    kit: Kit;
    synergy: number;
  }[];
}

export interface StrategyCounter {
  id: string;
  baseStrategyId: string;
  counterStrategyId: string;
  userId: string;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
}

export interface StrategyRating {
  id: string;
  strategyId: string;
  userId: string;
  effectivenessScore: number;
  counterabilityScore: number;
  createdAt: Date;
}

export const KitTypeColors = {
  Fighter: 'bg-red-500',
  Movement: 'bg-blue-500',
  Economy: 'bg-yellow-500',
  Ranged: 'bg-purple-500',
  Support: 'bg-green-500',
  Destroyer: 'bg-orange-500',
  Tank: 'bg-slate-500',
  Defender: 'bg-teal-500'
};

export const KitTypeIcons = {
  Fighter: '⚔️',
  Movement: '🏃',
  Economy: '💰',
  Ranged: '🎯',
  Support: '🛟',
  Destroyer: '💥',
  Tank: '🛡️',
  Defender: '🏰'
};

export const StrategyTagColors = {
  Rush: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Late: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Eco: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Troll: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
};