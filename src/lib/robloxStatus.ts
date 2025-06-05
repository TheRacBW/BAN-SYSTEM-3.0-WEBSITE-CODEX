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

export interface UserStatus {
  userId: number;
  username: string;
  isOnline: boolean;
  inBedwars: boolean;
  placeId: number | null;
  rootPlaceId: number | null;
  universeId: number | null;
  lastUpdated: number;
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

async function getUserPresence(userId: number, cookie?: string): Promise<UserPresence> {
  const data = await fetchJson('https://presence.roblox.com/v1/presence/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: '.ROBLOSECURITY=' + cookie } : {})
    },
    body: JSON.stringify({ userIds: [userId] })
  });
  if (!data.userPresences?.[0]) {
    throw new Error('No presence data');
  }
  return data.userPresences[0];
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

  const [presence, username] = await Promise.all([
    getUserPresence(userId, cookie),
    getUsernameFromId(userId)
  ]);

  const status: UserStatus = {
    userId,
    username,
    isOnline: [1, 2].includes(presence.userPresenceType),
    inBedwars:
      Number(presence.placeId) === BEDWARS_PLACE_ID ||
      Number(presence.rootPlaceId) === BEDWARS_PLACE_ID ||
      Number(presence.universeId) === BEDWARS_UNIVERSE_ID,
    placeId: presence.placeId ? Number(presence.placeId) : null,
    rootPlaceId: presence.rootPlaceId ? Number(presence.rootPlaceId) : null,
    universeId: presence.universeId ? Number(presence.universeId) : null,
    lastUpdated: Date.now()
  };
  statusCache.set(userId, status);
  return status;
}
