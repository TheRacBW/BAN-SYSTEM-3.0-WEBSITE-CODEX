import { RobloxUser, RobloxThumbnail } from '../types/leaderboard';

class RobloxApiService {
  private cache = new Map<string, { user: RobloxUser; timestamp: number }>();
  private thumbnailCache = new Map<number, { thumbnail: RobloxThumbnail; timestamp: number }>();
  private userIdBatchCache = new Map<string, { id: number; timestamp: number }>();
  private profilePicBatchCache = new Map<number, { url: string; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly BATCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Persistent cache keys
  private static USER_ID_CACHE_KEY = 'robloxUserIdCache';
  private static PROFILE_PIC_CACHE_KEY = 'robloxProfilePicCache';

  // Load persistent cache on init
  constructor() {
    this.loadPersistentCache();
  }

  private loadPersistentCache() {
    try {
      const userIdCacheRaw = localStorage.getItem(RobloxApiService.USER_ID_CACHE_KEY);
      if (userIdCacheRaw) {
        const parsed = JSON.parse(userIdCacheRaw);
        Object.entries(parsed).forEach(([name, val]: any) => {
          this.userIdBatchCache.set(name, val);
        });
      }
      const picCacheRaw = localStorage.getItem(RobloxApiService.PROFILE_PIC_CACHE_KEY);
      if (picCacheRaw) {
        const parsed = JSON.parse(picCacheRaw);
        Object.entries(parsed).forEach(([id, val]: any) => {
          this.profilePicBatchCache.set(Number(id), val);
        });
      }
    } catch (e) {
      // Ignore cache errors
    }
  }

  private savePersistentCache() {
    try {
      // Only keep fresh entries
      const now = Date.now();
      const userIdObj: Record<string, any> = {};
      this.userIdBatchCache.forEach((val, key) => {
        if (now - val.timestamp < this.BATCH_CACHE_DURATION) userIdObj[key] = val;
      });
      localStorage.setItem(RobloxApiService.USER_ID_CACHE_KEY, JSON.stringify(userIdObj));
      const picObj: Record<string, any> = {};
      this.profilePicBatchCache.forEach((val, key) => {
        if (now - val.timestamp < this.BATCH_CACHE_DURATION) picObj[key] = val;
      });
      localStorage.setItem(RobloxApiService.PROFILE_PIC_CACHE_KEY, JSON.stringify(picObj));
    } catch (e) {
      // Ignore cache errors
    }
  }

  /**
   * Get Roblox user ID from username
   */
  async getRobloxUserId(username: string): Promise<number | null> {
    try {
      console.log('Fetching Roblox user ID for:', username);
      const response = await fetch(`https://users.roblox.com/v1/usernames/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username] })
      });
      if (!response.ok) {
        console.warn(`Failed to get Roblox user ID for ${username}:`, response.status);
        return null;
      }
      const data = await response.json();
      const userId = data.data?.[0]?.id || null;
      console.log(`Roblox user ID for ${username}:`, userId);
      return userId;
    } catch (error) {
      console.error('Failed to get Roblox user ID:', error);
      return null;
    }
  }

  /**
   * Get profile picture from user ID
   */
  async getRobloxProfilePicture(userId: number): Promise<string> {
    try {
      console.log('Fetching profile picture for user ID:', userId);
      
      const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`);
      
      if (!response.ok) {
        console.warn(`Failed to get profile picture for user ${userId}:`, response.status);
        return '/default-avatar.png';
      }
      
      const data = await response.json();
      const imageUrl = data.data?.[0]?.imageUrl || '/default-avatar.png';
      
      console.log(`Profile picture for user ${userId}:`, imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Failed to get profile picture:', error);
      return '/default-avatar.png';
    }
  }

  /**
   * Search for a Roblox user by username
   */
  async searchUser(username: string): Promise<RobloxUser | null> {
    try {
      console.log('Searching for Roblox user:', username);
      const userId = await this.getRobloxUserId(username);
      if (!userId) {
        console.log('No user ID found for:', username);
        return null;
      }
      const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);
      if (!response.ok) {
        console.warn(`Failed to get user data for ${userId}:`, response.status);
        return null;
      }
      const userData = await response.json();
      const user: RobloxUser = {
        id: userId,
        name: userData.name,
        displayName: userData.displayName
      };
      console.log('Found Roblox user:', user);
      return user;
    } catch (error) {
      console.error('Failed to search user:', error);
      return null;
    }
  }

  /**
   * Get profile picture for a user by username
   */
  async getProfilePictureByUsername(username: string): Promise<string> {
    try {
      const userId = await this.getRobloxUserId(username);
      if (!userId) {
        return '/default-avatar.png';
      }
      return await this.getRobloxProfilePicture(userId);
    } catch (error) {
      console.error('Failed to get profile picture by username:', error);
      return '/default-avatar.png';
    }
  }

  /**
   * Enrich leaderboard entry with Roblox data
   */
  async enrichLeaderboardEntry(entry: any): Promise<any> {
    try {
      // Skip if we already have user_id and profile_picture
      if (entry.user_id && entry.profile_picture) {
        return entry;
      }
      const user = await this.searchUser(entry.username);
      if (user) {
        const profilePicture = await this.getRobloxProfilePicture(user.id);
        return {
          ...entry,
          user_id: user.id,
          profile_picture: profilePicture
        };
      }
      return entry;
    } catch (error) {
      console.error('Failed to enrich leaderboard entry:', error);
      return entry;
    }
  }

  /**
   * Get Roblox profile URL
   */
  getRobloxProfileUrl(userId: number): string {
    return `https://www.roblox.com/users/${userId}/profile`;
  }

  /**
   * Batch get Roblox user IDs from usernames
   */
  async getUserIdsBatch(usernames: string[]): Promise<Map<string, number>> {
    const now = Date.now();
    const userIdMap = new Map<string, number>();
    const toFetch: string[] = [];
    // Check cache first
    for (const name of usernames) {
      const cached = this.userIdBatchCache.get(name);
      if (cached && now - cached.timestamp < this.BATCH_CACHE_DURATION) {
        userIdMap.set(name, cached.id);
      } else {
        toFetch.push(name);
      }
    }
    // Batch fetch only missing
    const batches = [];
    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      batches.push(toFetch.slice(i, i + batchSize));
    }
    for (const batch of batches) {
      try {
        const response = await fetch(`https://users.roblox.com/v1/usernames/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: batch, excludeBannedUsers: true })
        });
        const data = await response.json();
        data.data?.forEach((user: any) => {
          userIdMap.set(user.name, user.id);
          this.userIdBatchCache.set(user.name, { id: user.id, timestamp: now });
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Batch user ID fetch failed:', error);
      }
    }
    this.savePersistentCache();
    return userIdMap;
  }

  /**
   * Batch get profile pictures from user IDs
   */
  async getProfilePicturesBatch(userIds: number[]): Promise<Map<number, string>> {
    const now = Date.now();
    const pictureMap = new Map<number, string>();
    const toFetch: number[] = [];
    // Check cache first
    for (const id of userIds) {
      const cached = this.profilePicBatchCache.get(id);
      if (cached && now - cached.timestamp < this.BATCH_CACHE_DURATION) {
        pictureMap.set(id, cached.url);
      } else {
        toFetch.push(id);
      }
    }
    // Batch fetch only missing
    const batches = [];
    const batchSize = 100;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      batches.push(toFetch.slice(i, i + batchSize));
    }
    for (const batch of batches) {
      try {
        const idsParam = batch.join(',');
        const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${idsParam}&size=150x150&format=Png&isCircular=true`);
        const data = await response.json();
        data.data?.forEach((thumb: any) => {
          pictureMap.set(thumb.targetId, thumb.imageUrl || '/default-avatar.png');
          this.profilePicBatchCache.set(thumb.targetId, { url: thumb.imageUrl || '/default-avatar.png', timestamp: now });
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Batch profile picture fetch failed:', error);
      }
    }
    this.savePersistentCache();
    return pictureMap;
  }

  /**
   * Batch enrich multiple entries (for performance)
   */
  async enrichLeaderboardEntries(entries: any[]): Promise<any[]> {
    console.log('Batch enriching', entries.length, 'leaderboard entries');
    // Step 1: Batch user ID lookup
    const usernames = entries.map((e: any) => e.username);
    const userIdMap = await this.getUserIdsBatch(usernames);
    // Step 2: Batch profile picture lookup
    const userIds = Array.from(userIdMap.values()).filter(Boolean);
    const pictureMap = await this.getProfilePicturesBatch(userIds);
    // Step 3: Merge data
    return entries.map((entry: any) => {
      const cleanName = entry.username;
      const userId = userIdMap.get(cleanName);
      const profile_picture = userId ? pictureMap.get(userId) || '/default-avatar.png' : '/default-avatar.png';
      return {
        ...entry,
        user_id: userId || entry.user_id || null,
        profile_picture: profile_picture || entry.profile_picture || '/default-avatar.png'
      };
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.thumbnailCache.clear();
    this.userIdBatchCache.clear();
    this.profilePicBatchCache.clear();
  }
}

export const robloxApi = new RobloxApiService(); 