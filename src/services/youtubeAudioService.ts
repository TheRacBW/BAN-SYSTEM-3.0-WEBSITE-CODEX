// YouTube Audio Service for Admin Call Notifications
// Handles YouTube video audio extraction and caching

interface YouTubeAudioInfo {
  videoId: string;
  title: string;
  duration: number;
  audioUrl?: string;
  error?: string;
}

interface YouTubeAudioSettings {
  enabled: boolean;
  videoUrl: string;
  duration: number;
  audioUrl?: string;
}

class YouTubeAudioService {
  private static instance: YouTubeAudioService;

  static getInstance(): YouTubeAudioService {
    if (!YouTubeAudioService.instance) {
      YouTubeAudioService.instance = new YouTubeAudioService();
    }
    return YouTubeAudioService.instance;
  }

  // Extract video ID from YouTube URL
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  // Validate YouTube URL format
  validateYouTubeUrl(url: string): boolean {
    const videoId = this.extractVideoId(url);
    return videoId !== null && videoId.length === 11;
  }

  // Get video info using YouTube oEmbed API (no API key required)
  async getVideoInfo(videoId: string): Promise<YouTubeAudioInfo> {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      
      if (!response.ok) {
        throw new Error('Failed to get video info');
      }

      const data = await response.json();
      
      return {
        videoId,
        title: data.title,
        duration: 0, // oEmbed doesn't provide duration, but we don't need it for embedded playback
        audioUrl: undefined
      };
    } catch (error) {
      console.error('Failed to get video info:', error);
      throw error;
    }
  }

  // Test YouTube audio playback using embedded player
  async testYouTubeAudio(videoId: string, duration: number = 3): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create a hidden iframe for YouTube playback
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        
        // Set up YouTube embed with autoplay and muted (required for autoplay)
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&loop=0&start=0&end=${duration}`;
        
        // Add to DOM
        document.body.appendChild(iframe);
        
        // Remove after duration
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve();
        }, (duration + 1) * 1000);
        
      } catch (error) {
        console.error('YouTube audio test failed:', error);
        reject(error);
      }
    });
  }

  // Clear audio cache (no longer needed with embedded playback)
  clearCache(): void {
    // No-op since we don't cache anything anymore
  }

  // Get cache status (no longer needed with embedded playback)
  getCacheStatus(): { size: number; keys: string[] } {
    return {
      size: 0,
      keys: []
    };
  }
}

export default YouTubeAudioService.getInstance(); 