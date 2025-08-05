export type CardRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type CardType = 'Kit' | 'Skin';
export type TextTheme = 'dark' | 'light';
export type GoalType = 'daily_time' | 'weekly_time' | 'cards_collected' | 'packs_opened' | 'coins_earned';

export interface Card {
  id: string;
  kit_name: string;
  variant_name?: string;
  season: string;
  class_type: string;
  rarity: CardRarity;
  is_holo: boolean;
  holo_type: string;
  card_type: CardType;
  pack_type: string;
  image_url?: string;
  background_color: string;
  background_image_url?: string;
  ability_name?: string;
  ability_description?: string;
  flavor_text?: string;
  hp: number;
  weakness?: string;
  resistance: string;
  retreat_cost: number;
  unlock_requirement?: string;
  show_season_overlay: boolean;
  has_border: boolean;
  border_color: string;
  border_behind_holo: boolean;
  has_holo_mask: boolean;
  holo_mask_url?: string;
  card_frame_color: string;
  text_theme: TextTheme;
  created_at: string;
  updated_at: string;
}

export interface PackType {
  id: string;
  name: string;
  description?: string;
  price: number;
  card_count: number;
  rarity_weights: Record<CardRarity, number>;
  is_active: boolean;
  created_at: string;
}

export interface UserCoins {
  id: string;
  user_id: string;
  coins: number;
  total_earned: number;
  last_updated: string;
}

export interface UserInventory {
  id: string;
  user_id: string;
  card_id: string;
  quantity: number;
  is_equipped: boolean;
  obtained_at: string;
  obtained_from: string;
  card?: Card; // Joined with card data
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_type: GoalType;
  target_value: number;
  current_value: number;
  reward_coins: number;
  is_completed: boolean;
  expires_at?: string;
  created_at: string;
  completed_at?: string;
}

export interface UserSessionTime {
  id: string;
  user_id: string;
  session_start: string;
  session_end?: string;
  duration_seconds?: number;
  coins_earned: number;
  created_at: string;
}

export interface PackOpeningHistory {
  id: string;
  user_id: string;
  pack_type_id: string;
  cards_obtained: Card[];
  coins_spent: number;
  opened_at: string;
  pack_type?: PackType; // Joined with pack type data
}

export interface CardDisplayData extends Card {
  // Additional display properties
  rarityColor: string;
  rarityBgColor: string;
  classIcon: string;
  seasonImage?: string;
}

export interface PackOpeningResult {
  cards: Card[];
  coinsSpent: number;
  packType: PackType;
}

export interface GoalProgress {
  goal: UserGoal;
  progress: number;
  progressPercentage: number;
  timeRemaining?: number;
}

export interface CoinEarningMethod {
  id: string;
  name: string;
  description: string;
  coinsPerUnit: number;
  maxPerDay?: number;
  unit: 'minute' | 'hour' | 'action' | 'goal';
}

export const RARITY_COLORS: Record<CardRarity, { color: string; bg: string }> = {
  Common: { color: 'text-gray-700', bg: 'bg-gray-100' },
  Uncommon: { color: 'text-green-700', bg: 'bg-green-100' },
  Rare: { color: 'text-blue-700', bg: 'bg-blue-100' },
  Epic: { color: 'text-purple-700', bg: 'bg-purple-100' },
  Legendary: { color: 'text-orange-700', bg: 'bg-orange-100' }
};

export const RARITY_BORDER_COLORS: Record<CardRarity, string> = {
  Common: 'border-gray-400',
  Uncommon: 'border-green-400',
  Rare: 'border-blue-400',
  Epic: 'border-purple-400',
  Legendary: 'border-orange-400'
};

export const CLASS_ICONS: Record<string, string> = {
  Fighter: '⚔️',
  Support: '🛟',
  Tank: '🛡️',
  Ranged: '🎯',
  Movement: '🏃',
  Economy: '💰',
  Defender: '🏰',
  Destroyer: '💥'
};

export const SEASON_IMAGES: Record<string, string> = {
  'Season 1': 'https://via.placeholder.com/40x40/ff6b6b/fff?text=S1',
  'Season 2': 'https://via.placeholder.com/40x40/4ecdc4/fff?text=S2',
  'Season 3': 'https://via.placeholder.com/40x40/45b7d1/fff?text=S3',
  'Season 4': 'https://via.placeholder.com/40x40/96ceb4/fff?text=S4',
  'Season 5': 'https://via.placeholder.com/40x40/ffd93d/fff?text=S5',
  'Season 6': 'https://via.placeholder.com/40x40/6c5ce7/fff?text=S6',
  'Season 7': 'https://via.placeholder.com/40x40/fd79a8/fff?text=S7',
  'Season 8': 'https://via.placeholder.com/40x40/fdcb6e/fff?text=S8',
  'Season 9': 'https://via.placeholder.com/40x40/e17055/fff?text=S9',
  'Season 10': 'https://via.placeholder.com/40x40/74b9ff/fff?text=S10',
  'Season 11': 'https://via.placeholder.com/40x40/00b894/fff?text=S11',
  'Season 12': 'https://via.placeholder.com/40x40/a29bfe/fff?text=S12'
};

export const HOLO_TYPES = [
  { name: 'basic', label: 'Basic Glare', description: 'Simple glare effect that follows mouse' },
  { name: 'reverse', label: 'Reverse Holo', description: 'Background foil with masked glare' },
  { name: 'rare_holo', label: 'Vertical Beam', description: 'Classic vertical beam holo effect' },
  { name: 'galaxy', label: 'Galaxy Cosmos', description: 'Galaxy background with rainbow gradients' },
  { name: 'amazing', label: 'Amazing Rare', description: 'Intense glitter effect' },
  { name: 'radiant', label: 'Radiant', description: 'Criss-cross linear gradient pattern' },
  { name: 'trainer_gallery', label: 'Metallic Shine', description: 'Metallic iridescent effect' }
] as const;

export type HoloType = typeof HOLO_TYPES[number]['name'];

export const BEDWARS_KITS = [
  'Caitlyn', 'Whisper', 'Freiya', 'Vanessa', 'Yuzi', 'Barbarian', 'Evelynn', 'Builder', 'Archer'
] as const;

export const SEASONS = [
  'Season 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5', 'Season 6', 
  'Season 7', 'Season 8', 'Season 9', 'Season 10', 'Season 11', 'Season 12'
] as const;

export const CLASSES = [
  'Fighter', 'Support', 'Tank', 'Ranged', 'Movement', 'Economy', 'Defender', 'Destroyer'
] as const;

export const PACK_TYPES = [
  'Season Pack', 'Robux Pack', 'Event Pack', 'Whisper Pack', 'Nightmare Pack', 'Free Kit Pack'
] as const; 