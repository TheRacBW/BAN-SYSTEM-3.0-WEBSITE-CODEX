import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRestrictedUserIds() {
  const [restrictedIds, setRestrictedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchRestricted() {
      setLoading(true);
      const { data, error } = await supabase
        .from('restricted_user_ids')
        .select('roblox_user_id');
      
      console.log('🔒 Fetching restricted IDs:', { data, error });
      
      if (mounted) {
        const ids = data ? data.map((r: any) => r.roblox_user_id) : [];
        console.log('🔒 Set restricted IDs:', ids);
        setRestrictedIds(ids);
        setLoading(false);
      }
    }
    fetchRestricted();
    return () => { mounted = false; };
  }, []);

  return { restrictedIds, loading };
} 