import { supabase } from '../lib/supabase';
import { 
  Card, 
  PackType, 
  UserCoins, 
  UserInventory, 
  UserGoal, 
  UserSessionTime, 
  PackOpeningHistory,
  CardRarity,
  GoalType,
  SeasonConfig,
  PackTypeConfig
} from '../types/cards';

export class CardService {
  // Card Management
  static async getAllCards(): Promise<Card[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getCardsByPackType(packType: string): Promise<Card[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('pack_type', packType)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createCard(cardData: Omit<Card, 'id' | 'created_at' | 'updated_at'>): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .insert(cardData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateCard(id: string, cardData: Partial<Card>): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .update({ ...cardData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteCard(id: string): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Pack Types
  static async getAllPackTypes(): Promise<PackType[]> {
    const { data, error } = await supabase
      .from('pack_types')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createPackType(packData: Omit<PackType, 'id' | 'created_at'>): Promise<PackType> {
    const { data, error } = await supabase
      .from('pack_types')
      .insert(packData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updatePackType(id: string, packData: Partial<PackType>): Promise<PackType> {
    const { data, error } = await supabase
      .from('pack_types')
      .update(packData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deletePackType(id: string): Promise<void> {
    const { error } = await supabase
      .from('pack_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // User Coins
  static async getUserCoins(userId: string): Promise<UserCoins | null> {
    const { data, error } = await supabase
      .from('user_coins')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  }

  static async createUserCoins(userId: string, initialCoins: number = 0): Promise<UserCoins> {
    const { data, error } = await supabase
      .from('user_coins')
      .insert({
        user_id: userId,
        coins: initialCoins,
        total_earned: initialCoins
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateUserCoins(userId: string, coins: number, totalEarned?: number): Promise<UserCoins> {
    const updateData: any = { 
      coins, 
      last_updated: new Date().toISOString() 
    };
    
    if (totalEarned !== undefined) {
      updateData.total_earned = totalEarned;
    }

    const { data, error } = await supabase
      .from('user_coins')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async addCoins(userId: string, amount: number): Promise<UserCoins> {
    const currentCoins = await this.getUserCoins(userId);
    
    if (!currentCoins) {
      return this.createUserCoins(userId, amount);
    }

    return this.updateUserCoins(
      userId, 
      currentCoins.coins + amount,
      currentCoins.total_earned + amount
    );
  }

  static async spendCoins(userId: string, amount: number): Promise<UserCoins> {
    const currentCoins = await this.getUserCoins(userId);
    
    if (!currentCoins || currentCoins.coins < amount) {
      throw new Error('Insufficient coins');
    }

    return this.updateUserCoins(userId, currentCoins.coins - amount);
  }

  // User Inventory
  static async getUserInventory(userId: string): Promise<UserInventory[]> {
    const { data, error } = await supabase
      .from('user_inventory')
      .select(`
        *,
        card:cards(*)
      `)
      .eq('user_id', userId)
      .order('obtained_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async addCardToInventory(userId: string, cardId: string, obtainedFrom: string = 'pack'): Promise<UserInventory> {
    // Check if user already has this card
    const existing = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .single();

    if (existing.data) {
      // Update quantity
      const { data, error } = await supabase
        .from('user_inventory')
        .update({ quantity: existing.data.quantity + 1 })
        .eq('id', existing.data.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Add new card to inventory
      const { data, error } = await supabase
        .from('user_inventory')
        .insert({
          user_id: userId,
          card_id: cardId,
          quantity: 1,
          obtained_from: obtainedFrom
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  static async equipCard(userId: string, cardId: string): Promise<void> {
    // Unequip all other cards first
    await supabase
      .from('user_inventory')
      .update({ is_equipped: false })
      .eq('user_id', userId);

    // Equip the selected card
    const { error } = await supabase
      .from('user_inventory')
      .update({ is_equipped: true })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) throw error;
  }

  static async getEquippedCard(userId: string): Promise<UserInventory | null> {
    const { data, error } = await supabase
      .from('user_inventory')
      .select(`
        *,
        card:cards(*)
      `)
      .eq('user_id', userId)
      .eq('is_equipped', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Pack Opening
  static async openPack(userId: string, packTypeId: string): Promise<PackOpeningHistory> {
    // Get pack type
    const { data: packType, error: packError } = await supabase
      .from('pack_types')
      .select('*')
      .eq('id', packTypeId)
      .single();

    if (packError) throw packError;

    // Check if user has enough coins
    const userCoins = await this.getUserCoins(userId);
    if (!userCoins || userCoins.coins < packType.price) {
      throw new Error('Insufficient coins');
    }

    // Get all cards for this pack type
    const cards = await this.getCardsByPackType(packType.name);

    if (cards.length === 0) {
      throw new Error('No cards available for this pack type');
    }

    // Generate random cards based on rarity weights
    const selectedCards: Card[] = [];
    for (let i = 0; i < packType.card_count; i++) {
      const card = this.selectRandomCard(cards, packType.rarity_weights);
      if (card) {
        selectedCards.push(card);
      }
    }

    // Add cards to inventory
    for (const card of selectedCards) {
      await this.addCardToInventory(userId, card.id, 'pack');
    }

    // Spend coins
    await this.spendCoins(userId, packType.price);

    // Record pack opening
    const { data: history, error: historyError } = await supabase
      .from('pack_opening_history')
      .insert({
        user_id: userId,
        pack_type_id: packTypeId,
        cards_obtained: selectedCards,
        coins_spent: packType.price
      })
      .select()
      .single();

    if (historyError) throw historyError;

    // Update goals
    await this.updateGoalProgress(userId, 'packs_opened', 1);

    return history;
  }

  private static selectRandomCard(cards: Card[], rarityWeights: Record<CardRarity, number>): Card {
    // Calculate total weight
    const totalWeight = Object.values(rarityWeights).reduce((sum, weight) => sum + weight, 0);
    
    // Generate random number
    const random = Math.random() * totalWeight;
    
    // Determine rarity based on weights
    let currentWeight = 0;
    let selectedRarity: CardRarity = 'Common';
    
    for (const [rarity, weight] of Object.entries(rarityWeights)) {
      currentWeight += weight;
      if (random <= currentWeight) {
        selectedRarity = rarity as CardRarity;
        break;
      }
    }

    // Filter cards by selected rarity
    const cardsOfRarity = cards.filter(card => card.rarity === selectedRarity);
    
    if (cardsOfRarity.length === 0) {
      // Fallback to any card if no cards of selected rarity
      return cards[Math.floor(Math.random() * cards.length)];
    }

    return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
  }

  // Goals System
  static async getUserGoals(userId: string): Promise<UserGoal[]> {
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createGoal(userId: string, goalData: Omit<UserGoal, 'id' | 'user_id' | 'created_at'>): Promise<UserGoal> {
    const { data, error } = await supabase
      .from('user_goals')
      .insert({
        ...goalData,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateGoalProgress(userId: string, goalType: GoalType, increment: number): Promise<void> {
    const { data: goals, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_type', goalType)
      .eq('is_completed', false);

    if (error) throw error;

    for (const goal of goals || []) {
      const newValue = goal.current_value + increment;
      const isCompleted = newValue >= goal.target_value;

      const updateData: any = { current_value: newValue };
      
      if (isCompleted && !goal.is_completed) {
        updateData.is_completed = true;
        updateData.completed_at = new Date().toISOString();
        
        // Award coins for completed goal
        if (goal.reward_coins > 0) {
          await this.addCoins(userId, goal.reward_coins);
        }
      }

      await supabase
        .from('user_goals')
        .update(updateData)
        .eq('id', goal.id);
    }
  }

  // Session Time Tracking
  static async startSession(userId: string): Promise<UserSessionTime> {
    const { data, error } = await supabase
      .from('user_session_time')
      .insert({
        user_id: userId,
        session_start: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async endSession(sessionId: string): Promise<UserSessionTime> {
    const sessionEnd = new Date();
    
    const { data: session, error: fetchError } = await supabase
      .from('user_session_time')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError) throw fetchError;

    const sessionStart = new Date(session.session_start);
    const durationSeconds = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
    
    // Calculate coins earned (1 coin per 5 minutes)
    const coinsEarned = Math.floor(durationSeconds / 300);

    const { data, error } = await supabase
      .from('user_session_time')
      .update({
        session_end: sessionEnd.toISOString(),
        duration_seconds: durationSeconds,
        coins_earned: coinsEarned
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;

    // Add coins to user if any were earned
    if (coinsEarned > 0) {
      await this.addCoins(session.user_id, coinsEarned);
      await this.updateGoalProgress(session.user_id, 'daily_time', durationSeconds);
    }

    return data;
  }

  // Analytics
  static async getPackOpeningHistory(userId: string): Promise<PackOpeningHistory[]> {
    const { data, error } = await supabase
      .from('pack_opening_history')
      .select(`
        *,
        pack_type:pack_types(*)
      `)
      .eq('user_id', userId)
      .order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getInventoryStats(userId: string): Promise<{
    totalCards: number;
    uniqueCards: number;
    rarityBreakdown: Record<CardRarity, number>;
  }> {
    const inventory = await this.getUserInventory(userId);
    
    const totalCards = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueCards = inventory.length;
    
    const rarityBreakdown: Record<CardRarity, number> = {
      Common: 0,
      Uncommon: 0,
      Rare: 0,
      Epic: 0,
      Legendary: 0
    };

    for (const item of inventory) {
      if (item.card) {
        rarityBreakdown[item.card.rarity] += item.quantity;
      }
    }

    return {
      totalCards,
      uniqueCards,
      rarityBreakdown
    };
  }

  // Admin Functions
  static async assignCoinsToUser(userId: string, amount: number, reason: string = 'Admin assignment'): Promise<UserCoins> {
    return this.addCoins(userId, amount);
  }

  static async createDailyGoals(userId: string): Promise<UserGoal[]> {
    const goals: Omit<UserGoal, 'id' | 'user_id' | 'created_at'>[] = [
      {
        goal_type: 'daily_time',
        target_value: 60, // 1 hour
        current_value: 0,
        reward_coins: 50,
        is_completed: false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        goal_type: 'cards_collected',
        target_value: 5,
        current_value: 0,
        reward_coins: 25,
        is_completed: false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        goal_type: 'packs_opened',
        target_value: 2,
        current_value: 0,
        reward_coins: 30,
        is_completed: false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const createdGoals: UserGoal[] = [];
    for (const goal of goals) {
      try {
        const createdGoal = await this.createGoal(userId, goal);
        createdGoals.push(createdGoal);
      } catch (error) {
        console.error('Failed to create goal:', error);
      }
    }

    return createdGoals;
  }

  // Season Management
  static async getAllSeasons(): Promise<SeasonConfig[]> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createSeason(seasonData: Omit<SeasonConfig, 'id' | 'created_at' | 'updated_at'>): Promise<SeasonConfig> {
    const { data, error } = await supabase
      .from('seasons')
      .insert(seasonData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateSeason(id: string, seasonData: Partial<SeasonConfig>): Promise<SeasonConfig> {
    const { data, error } = await supabase
      .from('seasons')
      .update({ ...seasonData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteSeason(id: string): Promise<void> {
    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Pack Type Management
  static async getAllPackTypeConfigs(): Promise<PackTypeConfig[]> {
    const { data, error } = await supabase
      .from('pack_types')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createPackTypeConfig(packData: Omit<PackTypeConfig, 'id' | 'created_at' | 'updated_at'>): Promise<PackTypeConfig> {
    const { data, error } = await supabase
      .from('pack_types')
      .insert(packData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updatePackTypeConfig(id: string, packData: Partial<PackTypeConfig>): Promise<PackTypeConfig> {
    const { data, error } = await supabase
      .from('pack_types')
      .update({ ...packData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deletePackTypeConfig(id: string): Promise<void> {
    const { error } = await supabase
      .from('pack_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
} 