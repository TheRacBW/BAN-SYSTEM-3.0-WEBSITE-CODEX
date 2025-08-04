import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAudioAlerts } from '../hooks/useAudioAlerts';
import { supabase } from '../lib/supabase';

interface AdminCall {
  id: string;
  created_at: string;
  status: string;
}

interface AdminPreferences {
  sound_enabled: boolean;
  sound_type: string;
  sound_volume: number;
}

const AdminAudioManager: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [preferences, setPreferences] = useState<AdminPreferences | null>(null);
  const [lastCallIds, setLastCallIds] = useState<Set<string>>(new Set());
  
  const isAdminUser = isAdmin || (user && (user as any).trust_level >= 2);

  const audioAlerts = useAudioAlerts({
    enabled: preferences?.sound_enabled ?? false,
    soundType: (preferences?.sound_type as any) ?? 'default',
    volume: preferences?.sound_volume ?? 0.7,
    adminId: user?.id
  });

  useEffect(() => {
    if (!isAdminUser || !user) return;

    loadPreferences();
    
    // Set up real-time subscription for new calls
    const subscription = supabase
      .channel('audio_alerts_channel')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'admin_call_alerts',
          filter: 'status=eq.active'
        },
        handleNewCall
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdminUser, user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_admin_preferences', {
        admin_user_id: user.id
      });

      if (error) throw error;
      setPreferences(data);
    } catch (err) {
      console.error('Error loading admin preferences:', err);
    }
  };

  const handleNewCall = (payload: any) => {
    const newCall = payload.new as AdminCall;
    
    // Only play sound if this is a genuinely new call
    if (!lastCallIds.has(newCall.id)) {
      setLastCallIds(prev => new Set([...prev, newCall.id]));
      
      // Check if admin is currently active
      checkAdminStatusAndPlaySound();
    }
  };

  const checkAdminStatusAndPlaySound = async () => {
    if (!user || !preferences?.sound_enabled) return;

    try {
      const { data } = await supabase
        .from('admin_availability')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      // Only play sound if admin is active
      if (data?.is_active) {
        audioAlerts.playAlert();
      }
    } catch (err) {
      console.error('Error checking admin status for audio alert:', err);
    }
  };

  // This component doesn't render anything - it's just for managing audio
  return null;
};

export default AdminAudioManager; 