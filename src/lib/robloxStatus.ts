import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';
import { ROBLOX_HEADERS } from '../constants/robloxHeaders';

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

export interface UserStatus {
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

const CACHE_DURATION = 60; // seconds
const statusCache = new Map<number, UserStatus>();

async function fetchJson(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...ROBLOX_HEADERS,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

const PRESENCE_API_PRIMARY =
  'https://roblox-proxy.theraccoonmolester.workers.dev/presence/v1/presence/users';
const PRESENCE_API_FALLBACK =
  'https://presence.roproxy.com/v1/presence/users';
const PRESENCE_API_DIRECT = 'https://presence.roblox.com/v1/presence/users';

async function getUserPresence(userId: number, cookie?: string): Promise<PresenceResult> {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: '.ROBLOSECURITY=' + cookie } : {})
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
      const data = await fetchJson(url, options);
      if (data.userPresences?.[0]) {
        return { presence: data.userPresences[0], method };
      }
    } catch {
      // try next url
    }
  }

  throw new Error('No presence data');
}

async function getUsernameFromId(userId: number): Promise<string> {
  const data = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
  if (!data.name) throw new Error('Username not found');
  return data.name;
}

export async function getUserStatus(userId: number, cookie?: string): Promise<UserStatus> {
  const cached = statusCache.get(userId);
  if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION * 1000) {
    return cached;
  }

  const [presenceResult, username] = await Promise.all([
    getUserPresence(userId, cookie),
    getUsernameFromId(userId)
  ]);

  const presence = presenceResult.presence;
  const presenceMethod = presenceResult.method;

  const status: UserStatus = {
    userId,
    username,
    isOnline: [1, 2].includes(presence.userPresenceType),
    isInGame: presence.userPresenceType === 2,
    inBedwars:
      presence.userPresenceType === 2 &&
      (Number(presence.placeId) === BEDWARS_PLACE_ID ||
        Number(presence.rootPlaceId) === BEDWARS_PLACE_ID ||
        Number(presence.universeId) === BEDWARS_UNIVERSE_ID),
    placeId: presence.placeId ? Number(presence.placeId) : null,
    rootPlaceId: presence.rootPlaceId ? Number(presence.rootPlaceId) : null,
    universeId: presence.universeId ? Number(presence.universeId) : null,
    lastUpdated: Date.now(),
    presenceMethod
  };
  statusCache.set(userId, status);
  return status;
}
