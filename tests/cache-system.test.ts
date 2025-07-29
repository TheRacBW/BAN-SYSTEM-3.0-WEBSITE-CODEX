import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessCacheManager } from '../src/utils/accessCacheManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock window and localStorage for Node.js environment
Object.defineProperty(global, 'window', {
  value: {
    localStorage: localStorageMock,
  },
  writable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AccessCacheManager', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    
    // Mock localStorage availability check to return true
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
  });

  describe('getCachedAccess', () => {
    it('should return null for non-existent cache', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = AccessCacheManager.getCachedAccess('user123', '/test-page');
      expect(result).toBeNull();
    });

    it('should return cached access for valid cache', () => {
      const mockCache = {
        userId: 'user123',
        trustLevel: 1,
        discordVerified: true,
        lastTrustChange: Date.now(),
        cacheTimestamp: Date.now(),
        pageAccess: {
          '/test-page': {
            pagePath: '/test-page',
            hasAccess: true,
            checkedAt: Date.now(),
            requirements: {
              minTrustLevel: 0,
              requiresDiscordVerification: false,
              requiresPaidVerification: false
            }
          }
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));
      const result = AccessCacheManager.getCachedAccess('user123', '/test-page');
      expect(result).toBe(true);
    });

    it('should return null for expired cache', () => {
      const mockCache = {
        userId: 'user123',
        trustLevel: 1,
        discordVerified: true,
        lastTrustChange: Date.now(),
        cacheTimestamp: Date.now() - (31 * 60 * 1000), // 31 minutes ago
        pageAccess: {
          '/test-page': {
            pagePath: '/test-page',
            hasAccess: true,
            checkedAt: Date.now() - (31 * 60 * 1000),
            requirements: {
              minTrustLevel: 0,
              requiresDiscordVerification: false,
              requiresPaidVerification: false
            }
          }
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));
      const result = AccessCacheManager.getCachedAccess('user123', '/test-page');
      expect(result).toBeNull();
    });
  });

  describe('setCachedAccess', () => {
    it('should create new cache entry', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      AccessCacheManager.setCachedAccess('user123', '/test-page', true, {
        minTrustLevel: 1,
        requiresDiscordVerification: false,
        requiresPaidVerification: false
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const setCalls = localStorageMock.setItem.mock.calls;
      // Find the call that contains the cache key
      const cacheCall = setCalls.find(call => call[0] && call[0].includes('user_access_cache_user123'));
      expect(cacheCall).toBeDefined();
      
      const savedCache = JSON.parse(cacheCall[1]);
      expect(savedCache.userId).toBe('user123');
      expect(savedCache.pageAccess['/test-page'].hasAccess).toBe(true);
    });

    it('should update existing cache entry', () => {
      const existingCache = {
        userId: 'user123',
        trustLevel: 1,
        discordVerified: true,
        lastTrustChange: Date.now(),
        cacheTimestamp: Date.now(),
        pageAccess: {
          '/existing-page': {
            pagePath: '/existing-page',
            hasAccess: false,
            checkedAt: Date.now(),
            requirements: {
              minTrustLevel: 0,
              requiresDiscordVerification: false,
              requiresPaidVerification: false
            }
          }
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingCache));
      
      AccessCacheManager.setCachedAccess('user123', '/new-page', true, {
        minTrustLevel: 1,
        requiresDiscordVerification: false,
        requiresPaidVerification: false
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const setCalls = localStorageMock.setItem.mock.calls;
      // Find the call that contains the cache key
      const cacheCall = setCalls.find(call => call[0] && call[0].includes('user_access_cache_user123'));
      expect(cacheCall).toBeDefined();
      
      const savedCache = JSON.parse(cacheCall[1]);
      expect(savedCache.pageAccess['/existing-page']).toBeDefined();
      expect(savedCache.pageAccess['/new-page']).toBeDefined();
    });
  });

  describe('invalidateCache', () => {
    it('should remove user cache', () => {
      AccessCacheManager.invalidateCache('user123');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_access_cache_user123');
    });
  });

  describe('isCacheValid', () => {
    it('should return false for non-existent cache', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = AccessCacheManager.isCacheValid('user123', 1, true);
      expect(result).toBe(false);
    });

    it('should return false when trust level changes', () => {
      const mockCache = {
        userId: 'user123',
        trustLevel: 1,
        discordVerified: true,
        lastTrustChange: Date.now(),
        cacheTimestamp: Date.now(),
        pageAccess: {}
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));
      const result = AccessCacheManager.isCacheValid('user123', 2, true); // Trust level changed
      expect(result).toBe(false);
    });

    it('should return false when Discord verification changes', () => {
      const mockCache = {
        userId: 'user123',
        trustLevel: 1,
        discordVerified: true,
        lastTrustChange: Date.now(),
        cacheTimestamp: Date.now(),
        pageAccess: {}
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));
      const result = AccessCacheManager.isCacheValid('user123', 1, false); // Discord verification changed
      expect(result).toBe(false);
    });

    it('should return true for valid cache', () => {
      const mockCache = {
        userId: 'user123',
        trustLevel: 1,
        discordVerified: true,
        lastTrustChange: Date.now(),
        cacheTimestamp: Date.now(),
        pageAccess: {}
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));
      const result = AccessCacheManager.isCacheValid('user123', 1, true);
      expect(result).toBe(true);
    });
  });
});