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

export interface UserStatus {
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

const CACHE_DURATION = 60; // seconds
const statusCache = new Map<string, UserStatus>();

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

async function getUserPresence(
  userId: number,
  cookie?: string,
  methodFilter?: 'primary' | 'fallback' | 'direct'
): Promise<PresenceResult> {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: '.ROBLOSECURITY=' + cookie } : {})
    },
    body: JSON.stringify({ userIds: [userId] })
  } as const;

  const urlMap = {
    primary: PRESENCE_API_PRIMARY,
    fallback: PRESENCE_API_FALLBACK,
    direct: PRESENCE_API_DIRECT
  } as const;

  const urls: [string, 'primary' | 'fallback' | 'direct'][] = methodFilter
    ? [[urlMap[methodFilter], methodFilter]]
    : [
        [PRESENCE_API_PRIMARY, 'primary'],
        [PRESENCE_API_FALLBACK, 'fallback'],
        [PRESENCE_API_DIRECT, 'direct']
      ];

  const attemptLog: PresenceAttempt[] = [];
  const cookieIncluded = !!cookie;

  for (const [url, method] of urls) {
    try {
      const data = await fetchJson(url, options);
      if (data.userPresences?.[0]) {
        attemptLog.push({ method, success: true, cookie: cookieIncluded });
        return {
          presence: data.userPresences[0],
          method,
          attempts: attemptLog,
          cookieProvided: cookieIncluded
        };
      }
      attemptLog.push({ method, success: false, cookie: cookieIncluded });
    } catch (err) {
      attemptLog.push({
        method,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        cookie: cookieIncluded
      });
    }
  }

  throw new Error('No presence data');
}

async function getUsernameFromId(userId: number): Promise<string> {
  const data = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
  if (!data.name) throw new Error('Username not found');
  return data.name;
}

export async function getUserStatus(
  userId: number,
  cookie?: string,
  methodFilter?: 'primary' | 'fallback' | 'direct'
): Promise<UserStatus> {
  const cacheKey = `${userId}-${methodFilter || 'auto'}`;
  const cached = statusCache.get(cacheKey);
  if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION * 1000) {
    return cached;
  }

  const [presenceResult, username] = await Promise.all([
    getUserPresence(userId, cookie, methodFilter),
    getUsernameFromId(userId)
  ]);

  const presence = presenceResult.presence;
  const presenceMethod = presenceResult.method;
  const attemptLog = presenceResult.attempts;
  const cookieProvided = presenceResult.cookieProvided;

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
    userPresenceType: presence.userPresenceType,
    placeId: presence.placeId ? Number(presence.placeId) : null,
    rootPlaceId: presence.rootPlaceId ? Number(presence.rootPlaceId) : null,
    universeId: presence.universeId ? Number(presence.universeId) : null,
    lastUpdated: Date.now(),
    presenceMethod,
    attemptLog,
    cookieProvided
  };
  statusCache.set(cacheKey, status);
  return status;
}
