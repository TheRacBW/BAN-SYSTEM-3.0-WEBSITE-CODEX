import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import YouTubeAudioService from '../services/youtubeAudioService';

interface AudioAlertOptions {
  enabled: boolean;
  soundType: 'default' | 'siren' | 'chime' | 'bell' | 'youtube';
  volume: number; // 0-1
  adminId?: string;
  youtubeSettings?: {
    videoUrl?: string;
    audioUrl?: string;
    duration?: number;
  };
}

interface AudioAlertHook {
  playAlert: (soundType?: string) => void;
  testSound: (soundType: string) => void;
  isPlaying: boolean;
  error: string | null;
}

// Sound file mappings
const SOUND_FILES = {
  default: '/sounds/default.mp3',
  chime: '/sounds/chime.mp3', 
  bell: '/sounds/bell.mp3',
  siren: '/sounds/siren.mp3',
  youtube: '' // Will be set dynamically
};

export const useAudioAlerts = (options: AudioAlertOptions): AudioAlertHook => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedCallIds = useRef<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      
      // Event listeners for audio state
      audioRef.current.addEventListener('loadstart', () => setError(null));
      audioRef.current.addEventListener('canplay', () => setError(null));
      audioRef.current.addEventListener('error', (e) => {
        setError('Failed to load audio file');
        setIsPlaying(false);
      });
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAlert = async (soundType?: string) => {
    if (!options.enabled) return;

    const soundToPlay = soundType || options.soundType;
    
    try {
      if (soundToPlay === 'youtube' && options.youtubeSettings?.videoUrl) {
        // Use YouTube embedded player for YouTube audio
        const videoId = YouTubeAudioService.extractVideoId(options.youtubeSettings.videoUrl);
        if (videoId) {
          setIsPlaying(true);
          
          // Create hidden iframe for YouTube playback
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.top = '-9999px';
          iframe.style.left = '-9999px';
          iframe.style.width = '1px';
          iframe.style.height = '1px';
          iframe.style.border = 'none';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
          
          const duration = options.youtubeSettings.duration || 3;
          iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&loop=0&start=0&end=${duration}`;
          
          document.body.appendChild(iframe);
          
          // Remove after duration
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            setIsPlaying(false);
          }, (duration + 1) * 1000);
          
          return;
        }
      }
      
      // Use regular audio for other sound types
      if (!audioRef.current) return;
      
      const soundFile = SOUND_FILES[soundToPlay as keyof typeof SOUND_FILES] || SOUND_FILES.default;
      audioRef.current.src = soundFile;
      audioRef.current.volume = options.volume;
      
      setIsPlaying(true);
      await audioRef.current.play();
      
    } catch (err) {
      console.warn('Audio play failed (user interaction may be required):', err);
      setError('Audio play failed - user interaction required');
      setIsPlaying(false);
    }
  };

  const testSound = (soundType: string) => {
    playAlert(soundType);
  };

  return {
    playAlert,
    testSound,
    isPlaying,
    error
  };
}; 