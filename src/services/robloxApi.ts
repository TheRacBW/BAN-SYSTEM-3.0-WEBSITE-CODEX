import { RobloxUser, RobloxThumbnail } from '../types/leaderboard';

class RobloxApiService {
  private cache = new Map<string, { user: RobloxUser; timestamp: number }>();
  private thumbnailCache = new Map<number, { thumbnail: RobloxThumbnail; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  /**
   * Get Roblox user ID from username
   */
  async getRobloxUserId(username: string): Promise<number | null> {
    // Remove @ symbol if present
    const cleanUsername = username.replace('@', '');
    
    try {
      console.log('Fetching Roblox user ID for:', cleanUsername);
      
      const response = await fetch(`https://users.roblox.com/v1/usernames/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanUsername] })
      });
      
      if (!response.ok) {
        console.warn(`Failed to get Roblox user ID for ${cleanUsername}:`, response.status);
        return null;
      }
      
      const data = await response.json();
      const userId = data.data?.[0]?.id || null;
      
      console.log(`Roblox user ID for ${cleanUsername}:`, userId);
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
   * Batch enrich multiple entries (for performance)
   */
  async enrichLeaderboardEntries(entries: any[]): Promise<any[]> {
    console.log('Enriching', entries.length, 'leaderboard entries');
    
    const enrichedEntries = await Promise.all(
      entries.map(async (entry, index) => {
        try {
          // Add delay to avoid rate limiting
          if (index > 0 && index % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          return await this.enrichLeaderboardEntry(entry);
        } catch (error) {
          console.error(`Failed to enrich entry ${index}:`, error);
          return entry;
        }
      })
    );

    console.log('Enrichment completed for', enrichedEntries.length, 'entries');
    return enrichedEntries;
  }

  clearCache(): void {
    this.cache.clear();
    this.thumbnailCache.clear();
  }
}

export const robloxApi = new RobloxApiService(); 