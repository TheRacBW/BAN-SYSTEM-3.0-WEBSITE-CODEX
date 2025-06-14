/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface PresenceResult {
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  username: string;
  userPresenceType?: number;
  placeId?: string;
  rootPlaceId?: string;
  universeId?: string;
  lastUpdated: number;
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
  presenceMethod: 'proxy' | 'direct';
  presence?: UserPresence;
}

// Constants
const CACHE_DURATION = 30000; // 30 seconds
const presenceCache = new Map<string, { data: UserStatus; timestamp: number }>();
const PROXY_URL = 'https://roblox-proxy.theraccoonmolester.workers.dev';
const ROBLOX_API = 'https://presence.roblox.com/v1/presence/users';
const BEDWARS_PLACE_ID = 6872265039;
const BEDWARS_UNIVERSE_ID = 2619619496;

// Get admin cookie from environment variable
const ADMIN_ROBLOX_COOKIE = Deno.env.get('ROBLOX_COOKIE') || '';

// Cache cleanup interval (every 5 minutes)
const CACHE_CLEANUP_INTERVAL = 300000;
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of presenceCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      presenceCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

async function fetchWithProxy(url: string, options: RequestInit): Promise<Response> {
  try {
    // Try proxy first
    const proxyResponse = await fetch(`${PROXY_URL}/presence/v1/presence/users`, options);
    if (proxyResponse.ok) {
      console.log('Successfully used proxy');
      return proxyResponse;
    }
    throw new Error('Proxy failed');
  } catch (error) {
    console.log('Proxy failed, using direct connection');
    // Fallback to direct
    return await fetch(ROBLOX_API, options);
  }
}

async function getUserPresence(userId: number): Promise<PresenceResult> {
  if (!ADMIN_ROBLOX_COOKIE) {
    throw new Error('Admin Roblox cookie not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'RobloxPresenceChecker/1.0',
    'Cookie': `.ROBLOSECURITY=${ADMIN_ROBLOX_COOKIE}`
  };

  try {
    const response = await fetchWithProxy(
      `${ROBLOX_API}/users/${userId}/presence`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch presence: ${response.statusText}`);
    }

    const presence = await response.json();
    console.log('Roblox Presence Response:', {
      userId,
      userPresenceType: presence.userPresenceType,
      placeId: presence.placeId,
      rootPlaceId: presence.rootPlaceId,
      universeId: presence.universeId,
      locationType: presence.locationType,
      lastLocation: presence.lastLocation
    });

    const isOnline = presence.userPresenceType !== 0;
    const isInGame = presence.userPresenceType === 2;
    
    // Debug BedWars detection
    const placeId = Number(presence.placeId);
    const rootPlaceId = Number(presence.rootPlaceId);
    const universeId = Number(presence.universeId);
    
    console.log('BedWars Detection:', {
      userId,
      isInGame,
      placeId,
      rootPlaceId,
      universeId,
      matchesPlaceId: placeId === 6872265039,
      matchesRootPlaceId: rootPlaceId === 6872265039,
      matchesUniverseId: universeId === 2619619496
    });

    const inBedwars = isInGame && (
      placeId === 6872265039 ||
      rootPlaceId === 6872265039 ||
      universeId === 2619619496
    );

    return {
      isOnline,
      isInGame,
      inBedwars,
      username: presence.username || '',
      userPresenceType: presence.userPresenceType,
      placeId: presence.placeId,
      rootPlaceId: presence.rootPlaceId,
      universeId: presence.universeId,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('Error fetching presence:', error);
    throw error;
  }
}

async function getUsernameFromId(userId: number): Promise<string> {
  const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);
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
    const cacheKey = `${userId}`;
    const cachedResult = presenceCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      console.log('Returning cached presence result for user:', userId);
      return cachedResult.data;
    }

    // Get username and presence data
    const [username, presenceResult] = await Promise.all([
      getUsernameFromId(userId),
      getUserPresence(userId)
    ]);

    const status: UserStatus = {
      userId,
      username,
      isOnline: presenceResult.isOnline,
      isInGame: presenceResult.isInGame,
      inBedwars: presenceResult.inBedwars,
      userPresenceType: presenceResult.userPresenceType,
      placeId: presenceResult.placeId,
      rootPlaceId: presenceResult.rootPlaceId,
      universeId: presenceResult.universeId,
      lastUpdated: Date.now(),
      presenceMethod: 'direct',
      presence: {
        userPresenceType: presenceResult.userPresenceType,
        lastLocation: '',
        placeId: presenceResult.placeId,
        rootPlaceId: presenceResult.rootPlaceId,
        gameId: null,
        universeId: presenceResult.universeId,
        userId,
        lastOnline: ''
      }
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('Missing required parameter: userId');
    }

    if (!ADMIN_ROBLOX_COOKIE) {
      throw new Error('Admin Roblox cookie not configured. Please set the ROBLOX_COOKIE environment variable.');
    }

    const status = await getUserStatus(userId);
    return new Response(JSON.stringify(status), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
