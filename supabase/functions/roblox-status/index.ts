/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, cookie',
  'Access-Control-Max-Age': '86400'
};

interface UserPresence {
  userPresenceType: number;
  lastLocation: string;
  placeId: number | null;
  rootPlaceId: number | null;
  gameId: string | null;
  universeId: number | null;
  userId: number;
  lastOnline: string;
}

interface PresenceAttempt {
  method: 'primary' | 'fallback' | 'direct';
  success: boolean;
  status?: number;
  error?: string;
  cookie?: boolean;
}

interface PresenceResult {
  presence: UserPresence;
  method: 'primary' | 'fallback' | 'direct';
  attempts: PresenceAttempt[];
  cookieProvided: boolean;
}

interface UserStatus {
  userId: number;
  username: string;
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  userPresenceType: number | null;
  placeId: number | null;
  rootPlaceId: number | null;
  universeId: number | null;
  lastUpdated: number;
  presenceMethod: 'primary' | 'fallback' | 'direct';
  attemptLog: PresenceAttempt[];
  cookieProvided: boolean;
  presence?: UserPresence;
}

// Cache configuration
const CACHE_DURATION = 30000; // 30 seconds
const presenceCache = new Map<string, { data: UserStatus; timestamp: number }>();
const cookieCache = new Map<string, { cookie: string; timestamp: number }>();

// Cache cleanup interval (every 5 minutes)
const CACHE_CLEANUP_INTERVAL = 300000;
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of presenceCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      presenceCache.delete(key);
    }
  }
  for (const [key, value] of cookieCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cookieCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from './bedwars.ts';
import { ROBLOX_HEADERS } from './robloxHeaders.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function getRobloxCookie(supabase: SupabaseClient): Promise<string> {
  // Check cache first
  const cachedCookie = cookieCache.get('global');
  if (cachedCookie && Date.now() - cachedCookie.timestamp < CACHE_DURATION) {
    return cachedCookie.cookie;
  }

  const envCookie = Deno.env.get('ROBLOX_COOKIE');
  try {
    const { data } = await supabase
      .from('roblox_settings')
      .select('cookie')
      .eq('id', 'global')
      .single();
    
    const cookie = (data?.cookie || envCookie || '').trim();
    
    // Cache the result
    if (cookie) {
      cookieCache.set('global', { cookie, timestamp: Date.now() });
    }
    
    return cookie;
  } catch {
    return (envCookie || '').trim();
  }
}

const REQUEST_TIMEOUT = 15000; // Increased to 15 seconds

const statusCache = new Map<string, UserStatus>();

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...ROBLOX_HEADERS,
        ...(options.headers || {})
      }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<Response> {
  try {
    const response = await fetchWithTimeout(url, options);
    
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

const PRESENCE_API_PRIMARY =
  'https://roblox-proxy.theraccoonmolester.workers.dev/presence/v1/presence/users';
const PRESENCE_API_FALLBACK = 'https://presence.roproxy.com/v1/presence/users';
const PRESENCE_API_DIRECT = 'https://presence.roblox.com/v1/presence/users';

async function getUserPresence(
  userId: number,
  methodFilter: 'primary' | 'fallback' | 'direct' | undefined,
  cookieOverride: string | undefined,
  supabase: SupabaseClient
): Promise<PresenceResult> {
  // Get and validate cookie
  const cookie = cookieOverride || (await getRobloxCookie(supabase));
  const cookieIncluded = !!cookie?.trim();
  
  if (cookieIncluded) {
    console.log('Cookie provided, length:', cookie.length);
  } else {
    console.warn('No .ROBLOSECURITY cookie provided for presence request');
  }

  // Prepare headers with proper cookie format
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Roblox/WinInet'
  };

  if (cookieIncluded) {
    // Ensure cookie is properly formatted
    const trimmedCookie = cookie.trim();
    if (!trimmedCookie.startsWith('_|WARNING:-DO-NOT-SHARE-THIS')) {
      console.warn('Cookie may be invalid - does not start with expected prefix');
    }
    headers.Cookie = `.ROBLOSECURITY=${trimmedCookie}`;
  }

  const body = JSON.stringify({ userIds: [userId] });
  const options = {
    method: 'POST',
    headers,
    body
  } as const;

  // Log request details
  console.log('Presence Request Details:', {
    userId,
    cookieLength: cookieIncluded ? cookie.length : 0,
    headers: {
      ...headers,
      Cookie: cookieIncluded ? '[REDACTED]' : undefined
    },
    body
  });

  const urlMap = {
    primary: PRESENCE_API_PRIMARY,
    fallback: PRESENCE_API_FALLBACK,
    direct: PRESENCE_API_DIRECT
  } as const;

  const urls: [string, 'primary' | 'fallback' | 'direct'][] = methodFilter
    ? [[urlMap[methodFilter], methodFilter]]
    : cookieIncluded
      ? [[PRESENCE_API_DIRECT, 'direct']]
      : [
          [PRESENCE_API_PRIMARY, 'primary'],
          [PRESENCE_API_FALLBACK, 'fallback']
        ];

  const attemptLog: PresenceAttempt[] = [];

  for (const [url, method] of urls) {
    try {
      console.log(`Attempting presence request via ${method} endpoint`);
      const response = await fetchWithRetry(url, options);
      const text = await response.text();
      
      console.log(`Presence API Response (${method}):`, {
        status: response.status,
        statusText: response.statusText,
        body: text
      });

      const data = JSON.parse(text);
      
      if (data.userPresences?.[0]) {
        const presence = data.userPresences[0];
        console.log('Presence data received:', {
          userPresenceType: presence.userPresenceType,
          placeId: presence.placeId,
          universeId: presence.universeId,
          lastLocation: presence.lastLocation
        });

        attemptLog.push({
          method,
          success: true,
          status: response.status,
          cookie: cookieIncluded
        });

        return {
          presence,
          method,
          attempts: attemptLog,
          cookieProvided: cookieIncluded
        };
      }

      attemptLog.push({
        method,
        success: false,
        status: response.status,
        cookie: cookieIncluded
      });
    } catch (err) {
      console.error(`Error in ${method} attempt:`, err);
      attemptLog.push({
        method,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        cookie: cookieIncluded
      });
    }
  }

  throw new Error(`No presence data found for user ID ${userId}`);
}

async function getUsernameFromId(userId: number): Promise<string> {
  const response = await fetchWithRetry(`https://users.roblox.com/v1/users/${userId}`);
  
  const data = await response.json();
  if (!data.name) {
    throw new Error(`Username not found for ID ${userId}`);
  }
  return data.name;
}

async function getUserStatus(
  userId: number,
  methodFilter: 'primary' | 'fallback' | 'direct' | undefined,
  cookieOverride: string | undefined,
  supabase: SupabaseClient
): Promise<UserStatus> {
  try {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Invalid user ID provided');
    }

    // Check cache first
    const cacheKey = `${userId}-${methodFilter || 'auto'}-${cookieOverride ? 'custom' : 'global'}`;
    const cachedResult = presenceCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      console.log('Returning cached presence result for user:', userId);
      return cachedResult.data;
    }

    // Get username (this is a one-time operation per user)
    const username = await getUsernameFromId(userId);
    
    // Get presence data
    const presenceResult = await getUserPresence(userId, methodFilter, cookieOverride, supabase);
    const presence = presenceResult.presence;

    // Determine if user is in Bedwars
    const inBedwars = presence.placeId === BEDWARS_PLACE_ID || 
                      presence.universeId === BEDWARS_UNIVERSE_ID;

    const status: UserStatus = {
      userId,
      username,
      isOnline: presence.userPresenceType === 1 || presence.userPresenceType === 2,
      isInGame: presence.userPresenceType === 2,
      inBedwars,
      userPresenceType: presence.userPresenceType,
      placeId: presence.placeId,
      rootPlaceId: presence.rootPlaceId,
      universeId: presence.universeId,
      lastUpdated: Date.now(),
      presenceMethod: presenceResult.method,
      attemptLog: presenceResult.attempts,
      cookieProvided: presenceResult.cookieProvided,
      presence
    };

    // Cache the result
    presenceCache.set(cacheKey, { data: status, timestamp: Date.now() });

    return status;
  } catch (error) {
    console.error('Error getting user status:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    console.log('Incoming body:', body);

    const { userId, cookie, method } = body;
    console.log('Received cookie length:', typeof cookie === 'string' ? cookie.trim().length : 0);
    if (typeof userId !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      console.error(
        'Supabase environment variables missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      );
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const trimmedCookie =
      typeof cookie === 'string' ? cookie.trim() : undefined;
    console.log('Request cookie length:', trimmedCookie?.length || 0);

    const status = await getUserStatus(
      userId,
      method === 'auto' ? undefined : method,
      trimmedCookie,
      supabase
    );

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('roblox-status error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

export { getUserStatus };
