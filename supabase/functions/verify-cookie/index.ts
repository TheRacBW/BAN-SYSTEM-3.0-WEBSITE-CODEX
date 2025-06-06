const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400'
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
        console.error('Supabase environment variables are missing');
      }

      let res: Response;
      try {
        res = await fetch('https://users.roblox.com/v1/users/authenticated', {
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            'User-Agent': 'Roblox/WinInet'
          }
        });
      } catch (fetchErr) {
        console.error('Cookie verify fetch failed:', fetchErr);
        return new Response(
          JSON.stringify({ error: 'Fetch failed', details: String(fetchErr) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('Roblox verification failed:', res.status, text);
        return new Response(
          JSON.stringify({ error: 'Verification failed', status: res.status, details: text }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await res.json();
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { error } = await supabase
          .from('roblox_settings')
          .upsert({ id: 'global', cookie, updated_at: new Date().toISOString() });
        if (error) {
          console.error('Failed to store cookie:', error);
        }
      }

      return new Response(
        JSON.stringify({ name: data.name }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
