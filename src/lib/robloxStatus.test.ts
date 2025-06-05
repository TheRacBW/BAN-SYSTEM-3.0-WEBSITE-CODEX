import { describe, it, expect, vi, afterEach } from 'vitest';
import { getUserStatus } from './robloxStatus';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';

describe('getUserStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets bedwars fields from numeric presence data', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          userPresences: [{
            userPresenceType: 2,
            lastLocation: '',
            placeId: BEDWARS_PLACE_ID,
            rootPlaceId: BEDWARS_PLACE_ID,
            gameId: '1',
            universeId: BEDWARS_UNIVERSE_ID,
            userId: 1,
            lastOnline: ''
          }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'Tester' })
      });

    // @ts-ignore
    global.fetch = fetchMock;

    const status = await getUserStatus(1);
    expect(status.inBedwars).toBe(true);
    expect(status.placeId).toBe(BEDWARS_PLACE_ID);
    expect(status.rootPlaceId).toBe(BEDWARS_PLACE_ID);
    expect(status.universeId).toBe(BEDWARS_UNIVERSE_ID);
  });
});
