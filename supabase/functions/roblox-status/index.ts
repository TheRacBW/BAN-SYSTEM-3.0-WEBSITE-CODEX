
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
}

const CACHE_DURATION = 60; // Cache for 1 minute
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../../src/constants/bedwars.ts';
import { ROBLOX_HEADERS } from '../../src/constants/robloxHeaders.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function getRobloxCookie(supabase: SupabaseClient): Promise<string> {
  const envCookie = Deno.env.get('ROBLOX_COOKIE');
  try {
    const { data } = await supabase
      .from('roblox_settings')
      .select('cookie')
      .eq('id', 'global')
      .single();
    return (data?.cookie || envCookie || '').trim();
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
  const cookie = cookieOverride || (await getRobloxCookie(supabase));
  if (cookie) {
    console.log('Using ROBLOX_COOKIE for presence request');
  } else {
    console.warn('No .ROBLOSECURITY cookie supplied for presence request');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Roblox/WinInet'
  };
  if (cookie) {
    headers['Cookie'] = `.ROBLOSECURITY=${cookie}`;
  }
  const body = JSON.stringify({ userIds: [userId] });
  const options = {
    method: 'POST',
    headers,
    body
  } as const;

  const urlMap = {
    primary: PRESENCE_API_PRIMARY,
    fallback: PRESENCE_API_FALLBACK,
    direct: PRESENCE_API_DIRECT
  } as const;

  const cookieIncluded = !!cookie;

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
      console.log('Presence Request Inputs:', { cookieLength: cookie?.length, userId, method });
      const endpoint =
        method === 'direct'
          ? 'direct'
          : method === 'primary'
            ? 'roblox-proxy'
            : 'roproxy';
      console.log('Presence API endpoint:', endpoint, 'cookie attached:', cookieIncluded);
      console.log('Fetch URL:', url);
      console.log('Fetch Headers:', options.headers);
      console.log('Fetch Body:', body);
      const response = await fetchWithRetry(url, options);
      const text = await response.text();
      console.log('Presence API Status:', response.status);
      console.log('Presence API Body:', text);
      const data = JSON.parse(text);
      if (data.userPresences?.[0]) {
        if (method !== 'primary') {
          console.warn(`Presence API fallback method used: ${method}`);
        }
        attemptLog.push({
          method,
          success: true,
          status: response.status,
          cookie: cookieIncluded
        });
        return {
          presence: data.userPresences[0],
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
    const cacheKey = `${userId}-${methodFilter || 'auto'}`;
    const cached = statusCache.get(cacheKey);
    if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION * 1000) {
      return cached;
    }

    // Get presence data and username in parallel
    const [presenceResult, username] = await Promise.all([
      getUserPresence(userId, methodFilter, cookieOverride, supabase).catch(error => {
        console.error('Presence fetch error:', error);
        return null;
      }),
      getUsernameFromId(userId).catch(error => {
        console.error('Username fetch error:', error);
        return null;
      })
    ]);

    const presence = presenceResult ? presenceResult.presence : null;
    const presenceMethod = presenceResult ? presenceResult.method : 'primary';
    const attemptLog = presenceResult ? presenceResult.attempts : [];
    const cookieProvided = presenceResult ? presenceResult.cookieProvided : false;

    if (!username) {
      throw new Error(`Unable to find Roblox user with ID ${userId}`);
    }

    if (
      presence &&
      [1, 2].includes(presence.userPresenceType) &&
      (!presence.placeId || !presence.universeId)
    ) {
      console.warn(
        'Presence API response lacked placeId or universeId; ROBLOX_COOKIE may be invalid.'
      );
    }

    const status: UserStatus = {
      userId,
      username,
      isOnline: presence ? [1, 2].includes(presence.userPresenceType) : false,
      isInGame: presence ? presence.userPresenceType === 2 : false,
      inBedwars: presence && presence.userPresenceType === 2
        ? Number(presence.placeId) === BEDWARS_PLACE_ID ||
          Number(presence.rootPlaceId) === BEDWARS_PLACE_ID ||
          Number(presence.universeId) === BEDWARS_UNIVERSE_ID
        : false,
      userPresenceType: presence ? presence.userPresenceType : null,
      placeId: presence ? Number(presence.placeId) : null,
      rootPlaceId: presence ? Number(presence.rootPlaceId) : null,
      universeId: presence ? Number(presence.universeId) : null,
      lastUpdated: Date.now(),
      presenceMethod,
      attemptLog,
      cookieProvided
    };

    // Update cache
    statusCache.set(cacheKey, status);
    return { ...status, presence };
  } catch (error) {
    console.error('Error in getUserStatus:', error);
    throw error;
  }
}

if (import.meta.main) {
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
      const supabase = createClient(supabaseUrl, serviceKey);

      const { presence } = await getUserPresence(
        userId,
        method === 'auto' ? undefined : method,
        typeof cookie === 'string' ? cookie.trim() : undefined,
        supabase
      );

      return new Response(JSON.stringify(presence), {
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
}

export { getUserStatus };
