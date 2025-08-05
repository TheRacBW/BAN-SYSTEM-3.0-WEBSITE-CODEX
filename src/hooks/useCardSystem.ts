import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CardService } from '../services/cardService';
import { 
  Card, 
  PackType, 
  UserCoins, 
  UserInventory, 
  UserGoal, 
  UserSessionTime,
  PackOpeningHistory 
} from '../types/cards';

export const useCardSystem = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [packTypes, setPackTypes] = useState<PackType[]>([]);
  const [userCoins, setUserCoins] = useState<UserCoins | null>(null);
  const [userInventory, setUserInventory] = useState<UserInventory[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
  const [sessionTime, setSessionTime] = useState<UserSessionTime | null>(null);
  const [packHistory, setPackHistory] = useState<PackOpeningHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all card system data
  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [
        cardsData,
        packTypesData,
        coinsData,
        inventoryData,
        goalsData,
        historyData
      ] = await Promise.all([
        CardService.getAllCards(),
        CardService.getAllPackTypes(),
        CardService.getUserCoins(user.id),
        CardService.getUserInventory(user.id),
        CardService.getUserGoals(user.id),
        CardService.getPackOpeningHistory(user.id)
      ]);

      setCards(cardsData);
      setPackTypes(packTypesData);
      setUserCoins(coinsData);
      setUserInventory(inventoryData);
      setUserGoals(goalsData);
      setPackHistory(historyData);
    } catch (err) {
      console.error('Error loading card system data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Start a new session
  const startSession = async () => {
    if (!user) return;
    
    try {
      const session = await CardService.startSession(user.id);
      setSessionTime(session);
      return session;
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  // End current session
  const endSession = async () => {
    if (!sessionTime) return;
    
    try {
      const endedSession = await CardService.endSession(sessionTime.id);
      setSessionTime(null);
      await loadData(); // Refresh coins
      return endedSession;
    } catch (err) {
      console.error('Error ending session:', err);
      setError(err instanceof Error ? err.message : 'Failed to end session');
    }
  };

  // Open a pack
  const openPack = async (packTypeId: string) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await CardService.openPack(user.id, packTypeId);
      await loadData(); // Refresh all data
      return result;
    } catch (err) {
      console.error('Error opening pack:', err);
      setError(err instanceof Error ? err.message : 'Failed to open pack');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Equip a card
  const equipCard = async (cardId: string) => {
    if (!user) return;
    
    try {
      await CardService.equipCard(user.id, cardId);
      await loadData(); // Refresh inventory
    } catch (err) {
      console.error('Error equipping card:', err);
      setError(err instanceof Error ? err.message : 'Failed to equip card');
    }
  };

  // Get inventory stats
  const getInventoryStats = async () => {
    if (!user) return null;
    
    try {
      return await CardService.getInventoryStats(user.id);
    } catch (err) {
      console.error('Error getting inventory stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to get inventory stats');
      return null;
    }
  };

  // Create daily goals
  const createDailyGoals = async () => {
    if (!user) return;
    
    try {
      const goals = await CardService.createDailyGoals(user.id);
      setUserGoals(prev => [...prev, ...goals]);
      return goals;
    } catch (err) {
      console.error('Error creating daily goals:', err);
      setError(err instanceof Error ? err.message : 'Failed to create daily goals');
    }
  };

  // Admin functions
  const assignCoins = async (userId: string, amount: number) => {
    try {
      const result = await CardService.assignCoinsToUser(userId, amount);
      return result;
    } catch (err) {
      console.error('Error assigning coins:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign coins');
    }
  };

  // Get cards by pack type
  const getCardsByPackType = async (packType: string) => {
    try {
      return await CardService.getCardsByPackType(packType);
    } catch (err) {
      console.error('Error getting cards by pack type:', err);
      setError(err instanceof Error ? err.message : 'Failed to get cards');
      return [];
    }
  };

  // Create a new card (admin only)
  const createCard = async (cardData: Omit<Card, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const card = await CardService.createCard(cardData);
      setCards(prev => [card, ...prev]);
      return card;
    } catch (err) {
      console.error('Error creating card:', err);
      setError(err instanceof Error ? err.message : 'Failed to create card');
      throw err;
    }
  };

  // Update a card (admin only)
  const updateCard = async (cardId: string, cardData: Partial<Card>) => {
    try {
      const card = await CardService.updateCard(cardId, cardData);
      setCards(prev => prev.map(c => c.id === cardId ? card : c));
      return card;
    } catch (err) {
      console.error('Error updating card:', err);
      setError(err instanceof Error ? err.message : 'Failed to update card');
      throw err;
    }
  };

  // Delete a card (admin only)
  const deleteCard = async (cardId: string) => {
    try {
      await CardService.deleteCard(cardId);
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      console.error('Error deleting card:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete card');
      throw err;
    }
  };

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  return {
    // State
    cards,
    packTypes,
    userCoins,
    userInventory,
    userGoals,
    sessionTime,
    packHistory,
    loading,
    error,
    
    // Actions
    loadData,
    startSession,
    endSession,
    openPack,
    equipCard,
    getInventoryStats,
    createDailyGoals,
    assignCoins,
    getCardsByPackType,
    createCard,
    updateCard,
    deleteCard,
    
    // Utilities
    clearError: () => setError(null)
  };
}; 