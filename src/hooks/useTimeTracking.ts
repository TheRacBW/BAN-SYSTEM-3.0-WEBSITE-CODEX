import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { TimeTrackingService, UserTimeStats } from '../services/timeTrackingService';

export const useTimeTracking = () => {
  const { user } = useAuth();
  const [timeStats, setTimeStats] = useState<UserTimeStats | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Start time tracking for the current user
  const startTracking = useCallback(async () => {
    if (!user?.id) return;

    try {
      await TimeTrackingService.startTracking(user.id);
      setIsTracking(true);
      setLastUpdate(new Date());
      console.log('Time tracking started');
    } catch (error) {
      console.error('Failed to start time tracking:', error);
    }
  }, [user?.id]);

  // End time tracking for the current user
  const endTracking = useCallback(async () => {
    if (!user?.id) return;

    try {
      await TimeTrackingService.endCurrentSession();
      setIsTracking(false);
      setLastUpdate(new Date());
      console.log('Time tracking ended');
    } catch (error) {
      console.error('Failed to end time tracking:', error);
    }
  }, [user?.id]);

  // Load user time statistics
  const loadTimeStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const stats = await TimeTrackingService.getUserTimeStats(user.id);
      setTimeStats(stats);
    } catch (error) {
      console.error('Failed to load time stats:', error);
    }
  }, [user?.id]);

  // Force update coins (for admin use)
  const forceUpdateCoins = useCallback(async (userId: string) => {
    try {
      await TimeTrackingService.forceUpdateUserCoins(userId);
      await loadTimeStats();
    } catch (error) {
      console.error('Failed to force update coins:', error);
    }
  }, [loadTimeStats]);

  // Initialize time tracking when user logs in
  useEffect(() => {
    if (user?.id) {
      startTracking();
      loadTimeStats();
    } else {
      endTracking();
    }
  }, [user?.id, startTracking, endTracking, loadTimeStats]);

  // Clean up when component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id) {
        TimeTrackingService.endCurrentSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (user?.id) {
        TimeTrackingService.endCurrentSession();
      }
    };
  }, [user?.id]);

  // Refresh time stats periodically
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      loadTimeStats();
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, loadTimeStats]);

  return {
    timeStats,
    isTracking,
    lastUpdate,
    startTracking,
    endTracking,
    loadTimeStats,
    forceUpdateCoins,
  };
}; 