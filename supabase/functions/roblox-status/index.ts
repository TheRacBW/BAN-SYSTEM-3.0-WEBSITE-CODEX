
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
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

interface PresenceResult {
  presence: UserPresence;
  method: 'primary' | 'fallback' | 'direct';
}

interface UserStatus {
  userId: number;
  username: string;
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  placeId: number | null;
  rootPlaceId: number | null;
  universeId: number | null;
  lastUpdated: number;
  presenceMethod: 'primary' | 'fallback' | 'direct';
}

const CACHE_DURATION = 60; // Cache for 1 minute
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../../src/constants/bedwars.ts';
import { ROBLOX_HEADERS } from '../../src/constants/robloxHeaders.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, serviceKey);

async function getRobloxCookie(): Promise<string> {
  const envCookie = Deno.env.get('ROBLOX_COOKIE');
  try {
    const { data } = await supabase
      .from('roblox_settings')
      .select('cookie')
      .eq('id', 'global')
      .single();
    return (data?.cookie || envCookie || '').trim();
  } catch (_err) {
    return (envCookie || '').trim();
  }
}

const REQUEST_TIMEOUT = 15000; // Increased to 15 seconds

const statusCache = new Map<number, UserStatus>();

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

async function getUserPresence(userId: number): Promise<PresenceResult> {
  const cookie = await getRobloxCookie();
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': '.ROBLOSECURITY=' + cookie } : {})
    },
    body: JSON.stringify({ userIds: [userId] })
  } as const;

  const urls: [string, 'primary' | 'fallback' | 'direct'][] = [
    [PRESENCE_API_PRIMARY, 'primary'],
    [PRESENCE_API_FALLBACK, 'fallback'],
    [PRESENCE_API_DIRECT, 'direct']
  ];

  for (const [url, method] of urls) {
    try {
      const response = await fetchWithRetry(url, options);
      const data = await response.json();
      if (data.userPresences?.[0]) {
        return { presence: data.userPresences[0], method };
      }
    } catch {
      // try next url
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

async function getUserStatus(userId: number): Promise<UserStatus> {
  try {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Invalid user ID provided');
    }

    // Check cache first
    const cached = statusCache.get(userId);
    if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION * 1000) {
      return cached;
    }

    // Get presence data and username in parallel
    const [presenceResult, username] = await Promise.all([
      getUserPresence(userId).catch(error => {
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
      placeId: presence ? Number(presence.placeId) : null,
      rootPlaceId: presence ? Number(presence.rootPlaceId) : null,
      universeId: presence ? Number(presence.universeId) : null,
      lastUpdated: Date.now(),
      presenceMethod
    };

    // Update cache
    statusCache.set(userId, status);
    return status;
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
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get('userId');

    if (!userIdParam) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID format' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const status = await getUserStatus(userId);
    
    return new Response(
      JSON.stringify(status),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let status = 500;
    
    if (errorMessage.includes('not found')) {
      status = 404;
    } else if (errorMessage.includes('rate limit')) {
      status = 429;
    } else if (errorMessage.includes('timed out')) {
      status = 504;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : 'No details available'
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  });
}

export { getUserStatus };
