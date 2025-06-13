const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, cookie',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const { cookie } = await req.json();
      if (!cookie || typeof cookie !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Cookie is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      if (!supabaseUrl || !serviceKey) {
        return new Response(
          JSON.stringify({ error: 'Missing Supabase configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const trimmedCookie = cookie.trim();

      let res: Response | null = null;
      let verifyError: string | null = null;
      let username = '';

      try {
        res = await fetch('https://users.roblox.com/v1/users/authenticated', {
          headers: {
            Cookie: `.ROBLOSECURITY=${trimmedCookie}`,
            'User-Agent': 'Roblox/WinInet',
            'Referer': 'https://www.roblox.com/'
          }
        });

        if (!res.ok) {
          const text = await res.text();
          verifyError = `Verification failed: ${res.status} ${text}`;
        } else {
          const data = await res.json();
          username = data.name;
        }
      } catch (fetchErr) {
        verifyError = `Fetch failed: ${String(fetchErr)}`;
        console.error('Cookie verify fetch failed:', fetchErr);
      }

      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { error } = await supabase
          .from('roblox_settings')
          .upsert({ id: 'global', cookie: trimmedCookie, updated_at: new Date().toISOString() });
        if (error) {
          console.error('Failed to store cookie:', error);
        }
      }

      const body = verifyError
        ? { success: false, error: verifyError }
        : { success: true, name: username };

      return new Response(JSON.stringify(body), {
        status: verifyError ? 200 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('Verify-cookie error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  });
}
