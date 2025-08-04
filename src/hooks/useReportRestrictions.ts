import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ReportRestriction {
  id: string;
  restriction_type: 'warning' | 'temp_ban' | 'permanent_ban';
  reason: string;
  expires_at: string | null;
  created_at: string;
}

export const useReportRestrictions = () => {
  const { user } = useAuth();
  const [canSubmit, setCanSubmit] = useState<boolean | null>(null);
  const [restrictions, setRestrictions] = useState<ReportRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCanSubmit(false);
      setLoading(false);
      return;
    }

    const checkRestrictions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user can submit reports using the database function
        const { data: canSubmitData, error: canSubmitError } = await supabase.rpc('can_user_submit_reports', {
          user_uuid: user.id
        });

        if (canSubmitError) throw canSubmitError;

        // Get user's current restrictions
        const { data: restrictionsData, error: restrictionsError } = await supabase
          .from('user_report_restrictions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (restrictionsError) throw restrictionsError;

        setCanSubmit(canSubmitData);
        setRestrictions(restrictionsData || []);
      } catch (err) {
        console.error('Error checking report restrictions:', err);
        setError('Failed to check report restrictions');
        setCanSubmit(false);
      } finally {
        setLoading(false);
      }
    };

    checkRestrictions();
  }, [user]);

  const getActiveRestrictions = () => {
    const now = new Date();
    return restrictions.filter(restriction => {
      if (restriction.restriction_type === 'permanent_ban') return true;
      if (!restriction.expires_at) return false;
      return new Date(restriction.expires_at) > now;
    });
  };

  const getRestrictionMessage = () => {
    const activeRestrictions = getActiveRestrictions();
    if (activeRestrictions.length === 0) return null;

    const restriction = activeRestrictions[0]; // Get the most recent one
    const type = restriction.restriction_type === 'warning' ? 'Warning' :
                 restriction.restriction_type === 'temp_ban' ? 'Temporary Ban' :
                 'Permanent Ban';

    let message = `You are currently restricted from submitting reports: ${type}`;
    
    if (restriction.reason) {
      message += ` - ${restriction.reason}`;
    }

    if (restriction.expires_at && restriction.restriction_type !== 'permanent_ban') {
      message += ` (Expires: ${new Date(restriction.expires_at).toLocaleString()})`;
    }

    return message;
  };

  return {
    canSubmit,
    restrictions,
    activeRestrictions: getActiveRestrictions(),
    restrictionMessage: getRestrictionMessage(),
    loading,
    error
  };
}; 