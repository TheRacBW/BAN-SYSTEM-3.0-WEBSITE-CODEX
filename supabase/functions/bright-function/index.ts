/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_EXPIRY_DAYS = 7;

const getWorkingHeaders = (cookie?: string) => ({
  'Content-Type': 'application/json',
  'User-Agent': 'Roblox/WinInet',
  'Referer': 'https://www.roblox.com/',
  'Accept': 'application/json',
  ...(cookie ? { 'Cookie': `.ROBLOSECURITY=${cookie}` } : {})
});

interface CacheRow {
  username: string;
  user_id: string | number;
  cached_at: string;
}

interface UsernameResult {
  username: string;
  user_id: string | number | null;
  cached: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { usernames } = await req.json();
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid usernames'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get cookie from environment OR database
    let robloxCookie = Deno.env.get('ROBLOX_COOKIE');
    if (!robloxCookie) {
      const { data: settings } = await supabase
        .from('roblox_settings')
        .select('cookie')
        .eq('id', 'global')
        .single();
      robloxCookie = settings?.cookie;
    }

    // 1. Check cache for all usernames
    const { data: cachedRows } = await supabase
      .from('roblox_user_cache')
      .select('username, user_id, cached_at')
      .in('username', usernames);

    const now = new Date();
    const cachedMap: Map<string, CacheRow> = new Map();
    if (cachedRows) {
      for (const row of cachedRows as CacheRow[]) {
        cachedMap.set(row.username, {
          user_id: row.user_id,
          cached_at: row.cached_at,
          username: row.username
        });
      }
    }

    const results: UsernameResult[] = [];
    const toFetch: string[] = [];
    for (const username of usernames) {
      const cached = cachedMap.get(username);
      if (cached) {
        const cachedAt = new Date(cached.cached_at);
        const ageDays = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays < CACHE_EXPIRY_DAYS) {
          results.push({
            username,
            user_id: cached.user_id,
            cached: true
          });
          continue;
        }
      }
      toFetch.push(username);
    }

    // 2. Fetch missing/expired from Roblox API (in batches of 100)
    const BATCH_SIZE = 100;
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const robloxRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: getWorkingHeaders(robloxCookie),
        body: JSON.stringify({
          usernames: batch,
          excludeBannedUsers: false
        })
      });
      const robloxData = await robloxRes.json();
      if (robloxData.data && Array.isArray(robloxData.data)) {
        for (const user of robloxData.data) {
          results.push({
            username: user.requestedUsername,
            user_id: user.id || null,
            cached: false
          });
        }
      }
    }

    // 3. Upsert new/updated values into cache
    const upserts: { username: string; user_id: string | number; cached_at: string }[] = results.filter((r) => !r.cached && r.user_id).map((r) => ({
      username: r.username,
      user_id: r.user_id as string | number,
      cached_at: now.toISOString()
    }));
    if (upserts.length > 0) {
      console.log('[bright-function] Upserting to roblox_user_cache:', upserts);
      const { error: upsertError } = await supabase.from('roblox_user_cache').upsert(upserts);
      if (upsertError) {
        console.error('[bright-function] Cache upsert failed:', upsertError);
      } else {
        console.log('[bright-function] Cache upsert succeeded');
      }
    }

    return new Response(JSON.stringify({
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 