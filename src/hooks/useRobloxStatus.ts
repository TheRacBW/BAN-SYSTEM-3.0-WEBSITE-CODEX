import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';

interface RobloxStatus {
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  userPresenceType?: number;
  lastUpdated: number;
  username: string;
  placeId?: number;
  rootPlaceId?: number;
  universeId?: number;
  presenceMethod?: 'primary' | 'fallback' | 'direct';
}

export function useRobloxStatus(userId: number) {
  const [status, setStatus] = useState<RobloxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    const checkStatus = async () => {
      if (!userId) {
        setStatus(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeoutDuration = 20000; // Increased to 20 seconds
        timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        try {
          const { data, error: fnError } = await supabase.functions.invoke('roblox-status', {
            body: { userId },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (fnError) {
            const serverMsg = fnError.message || fnError.details;
            switch (fnError.status) {
              case 404:
                throw new Error(serverMsg || `Roblox user ID ${userId} not found`);
              case 429:
                if (retryCount < MAX_RETRIES) {
                  setRetryCount(count => count + 1);
                  timeoutId = setTimeout(checkStatus, RETRY_DELAY * Math.pow(2, retryCount));
                  return;
                }
                throw new Error(serverMsg || 'Rate limited. Please try again later');
              case 500:
                throw new Error(serverMsg || 'Unable to check Roblox status right now');
              case 503:
                throw new Error(serverMsg || 'Roblox API is temporarily unavailable');
              default:
                throw new Error(serverMsg || 'Unable to check player status');
            }
          }

          if (!data || typeof data.isOnline !== 'boolean') {
            throw new Error('Invalid response from status check');
          }

          if (mounted) {
            setStatus({
              isOnline: data.isOnline,
              isInGame: data.isInGame ?? (typeof data.placeId === 'number' || typeof data.universeId === 'number'),
              inBedwars: typeof data.inBedwars === 'boolean'
                ? data.inBedwars
                : (data.isInGame ?? false) && (
                    Number(data.placeId) === BEDWARS_PLACE_ID ||
                    Number(data.rootPlaceId) === BEDWARS_PLACE_ID ||
                    Number(data.universeId) === BEDWARS_UNIVERSE_ID
                  ),
              userPresenceType: data.userPresenceType,
              lastUpdated: data.lastUpdated || Date.now(),
              username: data.username || `User ${userId}`,
              placeId: data.placeId,
              rootPlaceId: data.rootPlaceId,
              universeId: data.universeId,
              presenceMethod: data.presenceMethod
            });
            setError(null);
            setRetryCount(0);
          }
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
          }
          throw fetchError;
        }
      } catch (err) {
        console.error('Error checking Roblox status:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to check status';
        
        if (mounted) {
          if (retryCount < MAX_RETRIES && 
             (errorMessage.includes('temporarily unavailable') || 
              errorMessage.includes('timed out') ||
              errorMessage.includes('Failed to fetch'))) {
            setRetryCount(count => count + 1);
            timeoutId = setTimeout(checkStatus, RETRY_DELAY * Math.pow(2, retryCount));
          } else {
            setError(errorMessage);
            setStatus(null);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (userId) {
      checkStatus();
      const interval = setInterval(checkStatus, 60000);
      
      return () => {
        mounted = false;
        clearInterval(interval);
        if (timeoutId) clearTimeout(timeoutId);
      };
    } else {
      setLoading(false);
      setError(null);
      setStatus(null);
    }
  }, [userId, retryCount]);

  return { status, loading, error };
}