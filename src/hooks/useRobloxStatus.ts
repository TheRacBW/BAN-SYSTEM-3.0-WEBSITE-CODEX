import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface RobloxStatus {
  isOnline: boolean;
  inBedwars: boolean;
  lastUpdated: number;
  username: string;
  placeId?: string;
}

export function useRobloxStatus(userId: number) {
  const [status, setStatus] = useState<RobloxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const BEDWARS_PLACE_ID = '6872265039';

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

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase configuration');
        }

        const apiUrl = `${supabaseUrl}/functions/v1/roblox-status`;
        
        const controller = new AbortController();
        const timeoutDuration = 20000; // Increased to 20 seconds
        timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        try {
          const response = await fetch(`${apiUrl}?userId=${userId}`, {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit'
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            switch (response.status) {
              case 404:
                throw new Error(`Roblox user ID ${userId} not found`);
              case 429:
                if (retryCount < MAX_RETRIES) {
                  setRetryCount(count => count + 1);
                  timeoutId = setTimeout(checkStatus, RETRY_DELAY * Math.pow(2, retryCount));
                  return;
                }
                throw new Error('Rate limited. Please try again later');
              case 500:
                throw new Error(errorData.error || 'Unable to check Roblox status right now');
              case 503:
                throw new Error('Roblox API is temporarily unavailable');
              default:
                throw new Error(
                  errorData.error || 
                  errorData.details || 
                  'Unable to check player status'
                );
            }
          }

          const data = await response.json();
          
          if (!data || typeof data.isOnline !== 'boolean') {
            throw new Error('Invalid response from status check');
          }

          if (mounted) {
            setStatus({
              isOnline: data.isOnline,
              inBedwars: data.placeId === BEDWARS_PLACE_ID,
              lastUpdated: data.lastUpdated || Date.now(),
              username: data.username || `User ${userId}`,
              placeId: data.placeId
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