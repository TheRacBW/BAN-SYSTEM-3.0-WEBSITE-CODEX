import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface UserVerificationStatus {
  id: string;
  username: string;
  email: string;
  trust_level: number;
  is_admin: boolean;
  discord_verified_at: string | null;
  discord_id: string | null;
  discord_username: string | null;
  is_discord_verified: boolean;
  is_paid_tracker_verified: boolean;
  created_at: string;
  last_login: string | null;
}

export interface PageAccessRequirements {
  page_path: string;
  min_trust_level: number;
  requires_discord_verification: boolean;
  requires_paid_verification: boolean;
  description: string;
}

export interface PageAccessResult {
  hasAccess: boolean;
  requirement: PageAccessRequirements | null;
  userStatus: UserVerificationStatus | null;
  loading: boolean;
  error: string | null;
  recheckAccess: () => Promise<void>;
}

export const usePageAccess = (pagePath: string): PageAccessResult => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [requirement, setRequirement] = useState<PageAccessRequirements | null>(null);
  const [userStatus, setUserStatus] = useState<UserVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAccess = async () => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get page access requirements
      const { data: pageReq, error: pageError } = await supabase
        .from('page_access_controls')
        .select('*')
        .eq('page_path', pagePath)
        .single();

      if (pageError && pageError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching page requirements:', pageError);
        setError('Failed to load page requirements');
        setLoading(false);
        return;
      }

      setRequirement(pageReq);

      // Get user verification status
      const { data: userStatusData, error: userError } = await supabase
        .from('user_verification_status')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user status:', userError);
        setError('Failed to load user status');
        setLoading(false);
        return;
      }

      setUserStatus(userStatusData);

      // Check access using database function
      const { data: accessResult, error: accessError } = await supabase.rpc('check_user_page_access', {
        user_uuid: user.id,
        page_path_param: pagePath
      });

      if (accessError) {
        console.error('Error checking page access:', accessError);
        setError('Failed to check page access');
        setLoading(false);
        return;
      }

      setHasAccess(accessResult || false);
    } catch (err) {
      console.error('Unexpected error in usePageAccess:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const recheckAccess = async () => {
    await checkAccess();
  };

  useEffect(() => {
    checkAccess();
  }, [user, pagePath]);

  return {
    hasAccess,
    requirement,
    userStatus,
    loading,
    error,
    recheckAccess
  };
};