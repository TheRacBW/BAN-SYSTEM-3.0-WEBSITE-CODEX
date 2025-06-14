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
  userPresenceType: number | null;
  placeId: string | null;
  rootPlaceId: string | null;
  universeId: string | null;
  lastUpdated: number;
}

interface UserStatus {
  userPresenceType: number | null | undefined;
  placeId: number | null | undefined;
  rootPlaceId: number | null | undefined;
  universeId: number | null | undefined;
  username?: string;
  lastLocation?: string;
}

// Constants
const CACHE_DURATION = 30000; // 30 seconds
const presenceCache = new Map<string, { data: UserStatus; timestamp: number }>();
const PROXY_URL = 'https://roblox-proxy.theraccoonmolester.workers.dev';
const ROBLOX_API = 'https://presence.roblox.com/v1/presence/users';
const BEDWARS_PLACE_ID = 6872265039;
const BEDWARS_UNIVERSE_ID = 6872265039;

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

// Step 1: Basic status check (lightweight)
async function getBasicRobloxStatus(userId: number): Promise<UserStatus | null> {
  if (!ADMIN_ROBLOX_COOKIE) {
    throw new Error('Admin Roblox cookie not configured');
  }

  const headers = {
    'Cookie': `.ROBLOSECURITY=${ADMIN_ROBLOX_COOKIE}`,
    'User-Agent': 'Roblox/WinInet',
    'Referer': 'https://www.roblox.com/',
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(`${ROBLOX_API}?userIds=${userId}`, { headers });
    
    if (!response.ok) {
      console.error(`[${userId}] Basic status check failed:`, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log(`[${userId}] Basic status response:`, JSON.stringify(data, null, 2));

    if (!data.userPresences?.[0]) {
      console.log(`[${userId}] No basic status found`);
      return null;
    }

    return data.userPresences[0];
  } catch (error) {
    console.error(`[${userId}] Error in basic status check:`, error);
    return null;
  }
}

// Step 2: Detailed presence check (only for in-game players)
async function getDetailedPresence(userId: number): Promise<UserStatus | null> {
  if (!ADMIN_ROBLOX_COOKIE) {
    throw new Error('Admin Roblox cookie not configured');
  }

  const headers = {
    'Cookie': `.ROBLOSECURITY=${ADMIN_ROBLOX_COOKIE}`,
    'User-Agent': 'Roblox/WinInet',
    'Referer': 'https://www.roblox.com/',
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(`${ROBLOX_API}?userIds=${userId}`, { headers });
    
    if (!response.ok) {
      console.error(`[${userId}] Detailed presence check failed:`, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log(`[${userId}] Detailed presence response:`, JSON.stringify(data, null, 2));

    if (!data.userPresences?.[0]) {
      console.log(`[${userId}] No detailed presence found`);
      return null;
    }

    return data.userPresences[0];
  } catch (error) {
    console.error(`[${userId}] Error in detailed presence check:`, error);
    return null;
  }
}

// Main function to get user presence
async function getUserPresence(userId: number): Promise<PresenceResult> {
  try {
    // Step 1: Get basic status
    const basicStatus = await getBasicRobloxStatus(userId);
    
    if (!basicStatus) {
      console.log(`[${userId}] No basic status available`);
      return {
        isOnline: false,
        isInGame: false,
        inBedwars: false,
        username: '',
        userPresenceType: null,
        placeId: null,
        rootPlaceId: null,
        universeId: null,
        lastUpdated: Date.now()
      };
    }

    // Basic status checks with safe type handling
    const isOnline = basicStatus.userPresenceType !== 0;
    const isInGame = basicStatus.userPresenceType === 2;

    // If not in game, return basic status
    if (!isInGame) {
      return {
        isOnline,
        isInGame: false,
        inBedwars: false,
        username: basicStatus.username || '',
        userPresenceType: basicStatus.userPresenceType ?? null,
        placeId: null,
        rootPlaceId: null,
        universeId: null,
        lastUpdated: Date.now()
      };
    }

    // Step 2: Get detailed presence only for in-game players
    const detailedStatus = await getDetailedPresence(userId);
    
    if (!detailedStatus) {
      console.log(`[${userId}] No detailed status available`);
      return {
        isOnline,
        isInGame,
        inBedwars: false,
        username: basicStatus.username || '',
        userPresenceType: basicStatus.userPresenceType ?? null,
        placeId: null,
        rootPlaceId: null,
        universeId: null,
        lastUpdated: Date.now()
      };
    }

    // Safe type conversion for IDs
    const placeId = detailedStatus.placeId ? String(detailedStatus.placeId) : null;
    const rootPlaceId = detailedStatus.rootPlaceId ? String(detailedStatus.rootPlaceId) : null;
    const universeId = detailedStatus.universeId ? String(detailedStatus.universeId) : null;

    // BedWars detection with safe type handling
    const inBedwars = universeId === String(BEDWARS_UNIVERSE_ID);

    console.log(`[${userId}] Final Status:`, {
      isOnline,
      isInGame,
      inBedwars,
      userPresenceType: basicStatus.userPresenceType,
      universeId
    });

    return {
      isOnline,
      isInGame,
      inBedwars,
      username: basicStatus.username || '',
      userPresenceType: basicStatus.userPresenceType ?? null,
      placeId,
      rootPlaceId,
      universeId,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error(`[${userId}] Error in getUserPresence:`, error);
    return {
      isOnline: false,
      isInGame: false,
      inBedwars: false,
      username: '',
      userPresenceType: null,
      placeId: null,
      rootPlaceId: null,
      universeId: null,
      lastUpdated: Date.now()
    };
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
