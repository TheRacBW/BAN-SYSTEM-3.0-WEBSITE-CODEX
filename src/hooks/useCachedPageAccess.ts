import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AccessCacheManager } from '../utils/accessCacheManager';

export interface CachedPageAccessResult {
  hasAccess: boolean | null;
  loading: boolean;
  error: string | null;
  requirement: {
    minTrustLevel: number;
    requiresDiscordVerification: boolean;
    requiresPaidVerification: boolean;
  } | null;
  recheckAccess: () => Promise<void>;
}

export const useCachedPageAccess = (pagePath: string): CachedPageAccessResult => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<{
    minTrustLevel: number;
    requiresDiscordVerification: boolean;
    requiresPaidVerification: boolean;
  } | null>(null);

  const checkPageAccess = useCallback(async () => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Check cache first for instant results
      const cachedAccess = AccessCacheManager.getCachedAccess(user.id, pagePath);
      if (cachedAccess !== null && AccessCacheManager.isCacheValid(user.id, user.trust_level || 0, user.discord_verified || false)) {
        setHasAccess(cachedAccess);
        setLoading(false);
        return;
      }

      // 2. Cache miss - make API call
      console.log(`Cache miss for ${pagePath}, making API call`);
      
      // Use batch access check if available, otherwise fall back to single page check
      const { data: batchResult, error: batchError } = await supabase.rpc('check_user_batch_access', {
        user_uuid: user.id,
        page_paths: [pagePath]
      });

      if (batchError) {
        // Fallback to single page check if batch function doesn't exist
        console.log('Batch function not available, using single page check');
        const { data: singleResult, error: singleError } = await supabase.rpc('check_user_page_access', {
          user_uuid: user.id,
          page_path_param: pagePath
        });

        if (singleError) {
          console.error('Error checking page access:', singleError);
          setError('Failed to check page access');
          setLoading(false);
          return;
        }

        setHasAccess(singleResult || false);
        
        // Get page requirements for caching
        const { data: pageReq } = await supabase
          .from('page_access_controls')
          .select('*')
          .eq('page_path', pagePath)
          .single();

        if (pageReq) {
          setRequirement({
            minTrustLevel: pageReq.min_trust_level,
            requiresDiscordVerification: pageReq.requires_discord_verification,
            requiresPaidVerification: pageReq.requires_paid_verification
          });

          // Update cache
          AccessCacheManager.setCachedAccess(user.id, pagePath, singleResult || false, {
            minTrustLevel: pageReq.min_trust_level,
            requiresDiscordVerification: pageReq.requires_discord_verification,
            requiresPaidVerification: pageReq.requires_paid_verification
          });
        }
      } else {
        // Use batch result
        if (batchResult?.length > 0) {
          const result = batchResult[0];
          setHasAccess(result.has_access);
          setRequirement({
            minTrustLevel: result.min_trust_level,
            requiresDiscordVerification: result.requires_discord_verification,
            requiresPaidVerification: result.requires_paid_verification
          });

          // Update cache
          AccessCacheManager.setCachedAccess(user.id, pagePath, result.has_access, {
            minTrustLevel: result.min_trust_level,
            requiresDiscordVerification: result.requires_discord_verification,
            requiresPaidVerification: result.requires_paid_verification
          });
        }
      }
    } catch (err) {
      console.error('Unexpected error in useCachedPageAccess:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [user, pagePath]);

  const setupRealtimeListener = useCallback(() => {
    if (!user) return;

    const subscription = supabase
      .channel('cache_invalidation')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        if (payload.new?.trust_level !== payload.old?.trust_level) {
          console.log('Trust level changed, invalidating cache');
          AccessCacheManager.invalidateCache(user.id);
          checkPageAccess(); // Refresh access
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'discord_verifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Discord verification changed, invalidating cache');
        AccessCacheManager.invalidateCache(user.id);
        checkPageAccess(); // Refresh access
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [user, checkPageAccess]);

  const recheckAccess = useCallback(async () => {
    // Force cache invalidation and recheck
    if (user) {
      AccessCacheManager.invalidatePage(user.id, pagePath);
    }
    await checkPageAccess();
  }, [user, pagePath, checkPageAccess]);

  useEffect(() => {
    checkPageAccess();
    const unsubscribe = setupRealtimeListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [checkPageAccess, setupRealtimeListener]);

  return {
    hasAccess,
    loading,
    error,
    requirement,
    recheckAccess
  };
};