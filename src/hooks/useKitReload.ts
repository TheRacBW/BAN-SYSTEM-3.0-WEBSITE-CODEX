import { useEffect } from 'react';
import { useKits } from '../context/KitContext';
import { supabase } from '../lib/supabase';

export const useKitReload = () => {
  const { kits, loading } = useKits();

  useEffect(() => {
    const checkAndReloadKits = async () => {
      if (!loading && kits.length === 0) {
        try {
          const { count } = await supabase
            .from('kits')
            .select('*', { count: 'exact', head: true });

          if (count && count > 0) {
            // Force reload the page to reinitialize all contexts
            window.location.reload();
          }
        } catch (error) {
          console.error('Error checking kits:', error);
        }
      }
    };

    checkAndReloadKits();
  }, [kits.length, loading]);

  return { hasKits: kits.length > 0, loading };
};