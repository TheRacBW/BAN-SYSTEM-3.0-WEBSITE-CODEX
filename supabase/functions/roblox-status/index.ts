import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

interface UserPresence {
  userPresenceType: number;
  lastLocation: string;
  placeId: string | null;
  rootPlaceId: string | null;
  gameId: string | null;
  universeId: string | null;
  userId: number;
  lastOnline: string;
}

interface UserStatus {
  userId: number;
  username: string;
  isOnline: boolean;
  inBedwars: boolean;
  lastUpdated: number;
}

const CACHE_DURATION = 60; // Cache for 1 minute
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const BEDWARS_UNIVERSE_ID = '2535881226';
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
        ...options.headers,
        'User-Agent': 'Roblox/Status/Checker',
        'Accept': 'application/json'
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

async function getUserPresence(userId: number): Promise<UserPresence> {
  const response = await fetchWithRetry('https://presence.roblox.com/v1/presence/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userIds: [userId]
    })
  });

  const data = await response.json();
  if (!data.userPresences?.[0]) {
    throw new Error(`No presence data found for user ID ${userId}`);
  }
  return data.userPresences[0];
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
    const [presence, username] = await Promise.all([
      getUserPresence(userId).catch(error => {
        console.error('Presence fetch error:', error);
        return null;
      }),
      getUsernameFromId(userId).catch(error => {
        console.error('Username fetch error:', error);
        return null;
      })
    ]);

    if (!username) {
      throw new Error(`Unable to find Roblox user with ID ${userId}`);
    }

    const status: UserStatus = {
      userId,
      username,
      isOnline: presence ? presence.userPresenceType !== 0 : false,
      inBedwars: presence ? presence.universeId === BEDWARS_UNIVERSE_ID : false,
      lastUpdated: Date.now()
    };

    // Update cache
    statusCache.set(userId, status);
    return status;
  } catch (error) {
    console.error('Error in getUserStatus:', error);
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