import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface AdminAvailabilityContextType {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  toggleAvailability: () => void;
  loading: boolean;
}

const AdminAvailabilityContext = createContext<AdminAvailabilityContextType | undefined>(undefined);

export const useAdminAvailability = () => {
  const context = useContext(AdminAvailabilityContext);
  if (context === undefined) {
    throw new Error('useAdminAvailability must be used within an AdminAvailabilityProvider');
  }
  return context;
};

interface AdminAvailabilityProviderProps {
  children: React.ReactNode;
}

export const AdminAvailabilityProvider: React.FC<AdminAvailabilityProviderProps> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [isActive, setIsActiveState] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAdminUser = isAdmin || (user && (user as any).trust_level >= 2);

  // Load initial availability status
  useEffect(() => {
    if (!isAdminUser || !user) return;

    const loadAvailability = async () => {
      try {
        const { data } = await supabase
          .from('admin_availability')
          .select('is_active')
          .eq('user_id', user.id)
          .single();

        setIsActiveState(data?.is_active || false);
      } catch (err) {
        console.error('Error loading admin availability:', err);
      }
    };

    loadAvailability();
  }, [isAdminUser, user]);

  // Listen to real-time availability changes
  useEffect(() => {
    if (!isAdminUser || !user) return;

    const subscription = supabase
      .channel('admin_availability_realtime')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_availability',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new) {
            setIsActiveState(payload.new.is_active);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdminUser, user]);

  const setIsActive = async (active: boolean) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('admin_availability')
        .upsert({
          user_id: user.id,
          is_active: active,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      // Update local state immediately for instant UI response
      setIsActiveState(active);
    } catch (err) {
      console.error('Error updating admin availability:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = () => {
    setIsActive(!isActive);
  };

  const value: AdminAvailabilityContextType = {
    isActive,
    setIsActive,
    toggleAvailability,
    loading
  };

  return (
    <AdminAvailabilityContext.Provider value={value}>
      {children}
    </AdminAvailabilityContext.Provider>
  );
}; 