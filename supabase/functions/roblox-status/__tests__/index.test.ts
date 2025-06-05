import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let getUserStatus: (id: number) => Promise<any>;

const userId = 123;

const presenceData = {
  userPresences: [
    {
      userPresenceType: 2,
      lastLocation: 'Bedwars',
      placeId: 6872265039,
      rootPlaceId: 6872265039,
      gameId: 'abc',
      universeId: 2619619496,
      userId,
      lastOnline: 'now'
    }
  ]
};

const usernameData = {
  name: 'TestUser'
};

function createResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('getUserStatus', () => {
  const fetchMock = vi.fn();

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
    const mod = await import('../index');
    getUserStatus = mod.getUserStatus;
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = String(url);
      if (s.includes('presence.roblox.com')) {
        return Promise.resolve(createResponse(presenceData));
      }
      if (s.includes('users.roblox.com')) {
        return Promise.resolve(createResponse(usernameData));
      }
      return Promise.resolve(createResponse({}, 500));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('handles numeric presence IDs', async () => {
    const status = await getUserStatus(userId);
    expect(status.inBedwars).toBe(true);
    expect(status.placeId).toBe('6872265039');
    expect(status.universeId).toBe('2619619496');
  });
});

