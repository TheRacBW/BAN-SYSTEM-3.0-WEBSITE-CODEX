import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AccessCacheManager } from '../utils/accessCacheManager';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  adminCheckComplete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminCheckComplete, setAdminCheckComplete] = useState(false);

  const checkUserProfile = async (user: User) => {
    try {
      console.log('Checking user profile for user ID:', user.id);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );
      
      const queryPromise = supabase
        .from('users')
        .select('is_admin, trust_level')
        .eq('id', user.id)
        .single();

      const { data: profile, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      console.log('Supabase profile response:', { profile, error });

      if (error) {
        console.error('Supabase query error:', error);
        // If user doesn't exist in users table, they're not admin
        setIsAdmin(false);
        setAdminCheckComplete(true);
        return;
      }

      const adminStatus = Boolean(profile?.is_admin);
      console.log('Setting isAdmin to:', adminStatus, 'based on profile:', profile);
      setIsAdmin(adminStatus);
      setAdminCheckComplete(true);
    } catch (error) {
      console.error('Error checking user profile:', error);
      // On error, assume not admin but don't block the app
      setIsAdmin(false);
      setAdminCheckComplete(true);
    }
  };

  const preloadPageAccess = async (user: User) => {
    try {
      console.log('Preloading page access for user:', user.id);
      
      // Preload access for common pages
      const commonPages = ['/strategies', '/premium-strategies', '/tracker', '/admin', '/leaderboard'];
      
      // Use batch access check if available
      const { data: batchResults, error: batchError } = await supabase.rpc('check_user_batch_access', {
        user_uuid: user.id,
        page_paths: commonPages
      });

      if (batchError) {
        console.log('Batch function not available, skipping preload');
        return;
      }

      // Cache all results
      if (batchResults?.length > 0) {
        batchResults.forEach((result: any) => {
          AccessCacheManager.setCachedAccess(user.id, result.page_path, result.has_access, {
            minTrustLevel: result.min_trust_level,
            requiresDiscordVerification: result.requires_discord_verification,
            requiresPaidVerification: result.requires_paid_verification
          });
        });
        console.log('Preloaded access for', batchResults.length, 'pages');
      }
    } catch (error) {
      console.error('Failed to preload page access:', error);
    }
  };

  const setupRealtimeListeners = (user: User) => {
    const subscription = supabase
      .channel('user_cache_invalidation')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'users',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        // Trust level changed
        if (payload.new.trust_level !== payload.old?.trust_level) {
          console.log('Trust level changed, invalidating cache');
          AccessCacheManager.invalidateCache(user.id);
          // Optionally show toast: "Your access level has been updated!"
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'discord_verifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Discord verification changed
        console.log('Discord verification changed, invalidating cache');
        AccessCacheManager.invalidateCache(user.id);
        // Optionally show toast: "Discord verification updated!"
      })
      .subscribe();

    return subscription;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      if (session?.user) {
        setUser(session.user);
      } else {
        setAdminCheckComplete(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, session?.user?.id);
      if (session?.user) {
        setUser(session.user);
        setAdminCheckComplete(false); // Reset when user changes
      } else {
        setUser(null);
        setIsAdmin(false);
        setAdminCheckComplete(true);
        // Clear cache on logout
        AccessCacheManager.clearAllCache();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Always check admin status when user changes
  useEffect(() => {
    console.log('User changed, checking admin status for:', user?.id);
    if (user) {
      setAdminCheckComplete(false); // Reset before checking
      checkUserProfile(user);
      // Preload page access and setup real-time listeners
      preloadPageAccess(user);
      const realtimeSubscription = setupRealtimeListeners(user);
      
      return () => {
        if (realtimeSubscription) {
          realtimeSubscription.unsubscribe();
        }
      };
    } else {
      console.log('No user, setting isAdmin to false');
      setIsAdmin(false);
      setAdminCheckComplete(true);
    }
  }, [user]);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    if (data.user) {
      await checkUserProfile(data.user);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (data.user) {
      await checkUserProfile(data.user);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Clear cache on logout
    AccessCacheManager.clearAllCache();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      signUp,
      signIn,
      signOut,
      loading,
      adminCheckComplete
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};