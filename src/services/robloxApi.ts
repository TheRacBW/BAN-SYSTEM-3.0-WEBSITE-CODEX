import { RobloxUser, RobloxThumbnail } from '../types/leaderboard';

class RobloxApiService {
  private cache = new Map<string, { user: RobloxUser; timestamp: number }>();
  private thumbnailCache = new Map<number, { thumbnail: RobloxThumbnail; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  async searchUser(username: string): Promise<RobloxUser | null> {
    // Check cache first
    const cached = this.cache.get(username);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.user;
    }

    try {
      const response = await fetch(
        `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`
      );

      if (!response.ok) {
        console.warn(`Failed to search for user ${username}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const user = data.data[0];
        const robloxUser: RobloxUser = {
          id: user.id,
          name: user.name,
          displayName: user.displayName
        };

        // Cache the result
        this.cache.set(username, { user: robloxUser, timestamp: Date.now() });
        return robloxUser;
      }

      return null;
    } catch (error) {
      console.error(`Error searching for user ${username}:`, error);
      return null;
    }
  }

  async getProfilePicture(userId: number): Promise<string | null> {
    // Check cache first
    const cached = this.thumbnailCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.thumbnail.imageUrl;
    }

    try {
      const response = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`
      );

      if (!response.ok) {
        console.warn(`Failed to get profile picture for user ${userId}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const thumbnail: RobloxThumbnail = data.data[0];
        
        // Cache the result
        this.thumbnailCache.set(userId, { thumbnail, timestamp: Date.now() });
        return thumbnail.imageUrl;
      }

      return null;
    } catch (error) {
      console.error(`Error getting profile picture for user ${userId}:`, error);
      return null;
    }
  }

  async enrichLeaderboardEntry(entry: any): Promise<any> {
    try {
      const user = await this.searchUser(entry.username);
      if (user) {
        const profilePicture = await this.getProfilePicture(user.id);
        return {
          ...entry,
          user_id: user.id,
          profile_picture: profilePicture
        };
      }
      return entry;
    } catch (error) {
      console.error(`Error enriching leaderboard entry for ${entry.username}:`, error);
      return entry;
    }
  }

  getRobloxProfileUrl(userId: number): string {
    return `https://www.roblox.com/users/${userId}/profile`;
  }

  clearCache(): void {
    this.cache.clear();
    this.thumbnailCache.clear();
  }
}

export const robloxApi = new RobloxApiService(); 