import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { TimeTrackingService, UserTimeStats } from '../services/timeTrackingService';

export const useTimeTracking = () => {
  const { user } = useAuth();
  const [timeStats, setTimeStats] = useState<UserTimeStats | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const startTracking = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsTracking(true);
      await TimeTrackingService.startTracking(user.id);
      
      // Load initial stats
      await loadTimeStats();
    } catch (error) {
      console.error('Error starting time tracking:', error);
    }
  }, [user?.id]);

  const endTracking = useCallback(async () => {
    try {
      await TimeTrackingService.endTracking();
      setIsTracking(false);
    } catch (error) {
      console.error('Error ending time tracking:', error);
    }
  }, []);

  const loadTimeStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const stats = await TimeTrackingService.getUserTimeStats(user.id);
      setTimeStats(stats);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading time stats:', error);
    }
  }, [user?.id]);

  const forceUpdateCoins = useCallback(async (userId: string) => {
    try {
      await TimeTrackingService.forceUpdateUserCoins(userId);
      await loadTimeStats();
    } catch (error) {
      console.error('Error forcing coin update:', error);
    }
  }, [loadTimeStats]);

  // Start tracking when user is authenticated
  useEffect(() => {
    if (user?.id && !isTracking) {
      startTracking();
    }
  }, [user?.id, isTracking, startTracking]);

  // Cleanup when user logs out
  useEffect(() => {
    if (!user?.id && isTracking) {
      endTracking();
    }
  }, [user?.id, isTracking, endTracking]);

  // Refresh stats periodically to show updated coin count
  useEffect(() => {
    if (!user?.id || !isTracking) return;

    console.log(`Setting up periodic stats refresh for user ${user.id}`);
    
    const interval = setInterval(async () => {
      try {
        console.log('Refreshing time stats...');
        await loadTimeStats();
      } catch (error) {
        console.error('Error refreshing time stats:', error);
      }
    }, 30 * 1000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user?.id, isTracking, loadTimeStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTracking) {
        endTracking();
      }
    };
  }, [isTracking, endTracking]);

  return {
    timeStats,
    isTracking,
    lastUpdate,
    startTracking,
    endTracking,
    loadTimeStats,
    forceUpdateCoins
  };
}; 