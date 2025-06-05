import React, { createContext, useContext, useState, useEffect } from 'react';
import { Kit, Strategy, KitReplacement, KitType } from '../types';
import { useBan } from './BanContext';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface KitContextType {
  kits: Kit[];
  strategies: Strategy[];
  selectedKitId: string | null;
  selectedStrategyId: string | null;
  selectedKits: string[];
  loading: boolean;
  selectKit: (kitId: string | null) => void;
  selectStrategy: (strategyId: string | null) => void;
  addKitToStrategy: (kitId: string) => void;
  removeKitFromStrategy: (kitId: string, index: number) => void;
  clearSelectedKits: () => void;
  getKitById: (id: string) => Kit | undefined;
  getKitsByType: (type: KitType) => Kit[];
  getReplacements: (kitId: string) => KitReplacement | null;
  filterStrategies: (query: string) => Strategy[];
  getSortedKits: (kits: Kit[]) => { type: KitType; kits: Kit[] }[];
}

const KitContext = createContext<KitContextType | undefined>(undefined);

export const KitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [kits, setKits] = useState<Kit[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { isBanned } = useBan();
  const { user } = useAuth();

  const fetchKits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kits')
        .select('*')
        .order('name');

      if (error) throw error;

      const transformedKits: Kit[] = data.map(kit => ({
        id: kit.id,
        name: kit.name,
        imageUrl: kit.image_url,
        image_url: kit.image_url,
        type: kit.type,
        payLocked: kit.pay_locked
      }));

      setKits(transformedKits);
    } catch (error) {
      console.error('Error fetching kits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKits();

    const channel = supabase.channel('kits_db_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'kits' 
        }, 
        (payload) => {
          console.log('Kit inserted:', payload);
          const newKit = payload.new as any;
          setKits(currentKits => [...currentKits, {
            id: newKit.id,
            name: newKit.name,
            imageUrl: newKit.image_url,
            image_url: newKit.image_url,
            type: newKit.type,
            payLocked: newKit.pay_locked
          }]);
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kits'
        },
        (payload) => {
          console.log('Kit updated:', payload);
          const updatedKit = payload.new as any;
          setKits(currentKits => 
            currentKits.map(kit => 
              kit.id === updatedKit.id 
                ? {
                    id: updatedKit.id,
                    name: updatedKit.name,
                    imageUrl: updatedKit.image_url,
                    image_url: updatedKit.image_url,
                    type: updatedKit.type,
                    payLocked: updatedKit.pay_locked
                  }
                : kit
            )
          );
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'kits'
        },
        (payload) => {
          console.log('Kit deleted:', payload);
          const deletedKit = payload.old as any;
          setKits(currentKits => 
            currentKits.filter(kit => kit.id !== deletedKit.id)
          );
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        let query = supabase
          .from('strategies')
          .select('*')
          .order('created_at', { ascending: false });

        if (user) {
          query = query.or(`user_id.eq.${user.id},is_public.eq.true`);
        } else {
          query = query.eq('is_public', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        const transformedStrategies = data.map(strategy => ({
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          kits: strategy.kit_ids,
          winRate: strategy.win_rate || 0.5,
          popularity: strategy.popularity || 0,
          effectiveness: strategy.effectiveness || 50,
          counterability: strategy.counterability || 50,
          createdBy: strategy.user_id,
          isPublic: strategy.is_public,
          createdAt: new Date(strategy.created_at),
          updatedAt: new Date(strategy.updated_at || strategy.created_at),
          user_id: strategy.user_id
        }));

        setStrategies(transformedStrategies);
      } catch (error) {
        console.error('Error fetching strategies:', error);
      }
    };

    fetchStrategies();

    const subscription = supabase
      .channel('strategies_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'strategies' 
        }, 
        () => {
          fetchStrategies();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const selectKit = (kitId: string | null) => {
    setSelectedKitId(kitId);
  };

  const selectStrategy = (strategyId: string | null) => {
    setSelectedStrategyId(strategyId);
  };

  const addKitToStrategy = (kitId: string) => {
    if (selectedKits.length < 5) {
      setSelectedKits(prev => [...prev, kitId]);
    }
  };

  const removeKitFromStrategy = (kitId: string, index: number) => {
    setSelectedKits(prev => prev.filter((_, i) => i !== index));
  };

  const clearSelectedKits = () => {
    setSelectedKits([]);
  };

  const getKitById = (id: string): Kit | undefined => {
    return kits.find(kit => kit.id === id);
  };

  const getKitsByType = (type: KitType): Kit[] => {
    return kits.filter(kit => kit.type === type);
  };

  const filterStrategies = (query: string): Strategy[] => {
    if (!query) return strategies;
    
    const lowercaseQuery = query.toLowerCase();
    return strategies.filter(strategy => {
      if (strategy.name.toLowerCase().includes(lowercaseQuery)) return true;
      if (strategy.description.toLowerCase().includes(lowercaseQuery)) return true;
      
      return strategy.kits.some(kitId => {
        const kit = getKitById(kitId);
        return kit?.name.toLowerCase().includes(lowercaseQuery);
      });
    });
  };

  const getReplacements = (kitId: string): KitReplacement | null => {
    const originalKit = getKitById(kitId);
    if (!originalKit) return null;
    
    const possibleReplacements = kits.filter(kit => 
      kit.type === originalKit.type && 
      kit.id !== kitId &&
      !isBanned(kit.id)
    );
    
    const replacements = possibleReplacements.map(kit => ({
      kit,
      synergy: Math.floor(Math.random() * 100)
    })).sort((a, b) => b.synergy - a.synergy);
    
    return {
      originalKit,
      replacements
    };
  };

  const getSortedKits = (kitsToSort: Kit[]) => {
    const kitTypes: KitType[] = ['Fighter', 'Movement', 'Economy', 'Ranged', 'Support', 'Destroyer', 'Tank', 'Defender'];
    
    const groupedKits = kitTypes.map(type => ({
      type,
      kits: kitsToSort
        .filter(kit => kit.type === type)
        .sort((a, b) => a.name.localeCompare(b.name))
    }))
    .filter(group => group.kits.length > 0);

    return groupedKits;
  };

  return (
    <KitContext.Provider value={{ 
      kits, 
      strategies, 
      selectedKitId, 
      selectedStrategyId,
      selectedKits,
      loading,
      selectKit, 
      selectStrategy,
      addKitToStrategy,
      removeKitFromStrategy,
      clearSelectedKits,
      getKitById, 
      getKitsByType,
      getReplacements,
      filterStrategies,
      getSortedKits
    }}>
      {children}
    </KitContext.Provider>
  );
};

export const useKits = (): KitContextType => {
  const context = useContext(KitContext);
  if (context === undefined) {
    throw new Error('useKits must be used within a KitProvider');
  }
  return context;
};