import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
        setTimeout(() => reject(new Error('Query timeout')), 5000)
      );
      
      const queryPromise = supabase
        .from('users')
        .select('is_admin')
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
      setIsAdmin(false);
      setAdminCheckComplete(true);
    }
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