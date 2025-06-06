const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400'
};

import { ROBLOX_HEADERS } from '../../src/constants/robloxHeaders.ts';

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

      let res: Response;
      try {
        res = await fetch('https://users.roblox.com/v1/users/authenticated', {
          headers: {
            ...ROBLOX_HEADERS,
            Cookie: `.ROBLOSECURITY=${cookie}`
          }
        });
      } catch (fetchErr) {
        console.error('Cookie verify fetch failed:', fetchErr);
        return new Response(
          JSON.stringify({ error: 'Fetch failed', details: String(fetchErr) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!res.ok) {
        const text = await res.text();
        return new Response(
          JSON.stringify({ error: 'Verification failed', status: res.status, details: text }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await res.json();
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
