import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AudioAlertOptions {
  enabled: boolean;
  soundType: 'default' | 'siren' | 'chime' | 'bell';
  volume: number; // 0-1
  adminId?: string;
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
  siren: '/sounds/siren.mp3'
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

  const playAlert = (soundType?: string) => {
    if (!options.enabled || !audioRef.current) return;

    const soundToPlay = soundType || options.soundType;
    const soundFile = SOUND_FILES[soundToPlay as keyof typeof SOUND_FILES] || SOUND_FILES.default;

    try {
      audioRef.current.src = soundFile;
      audioRef.current.volume = options.volume;
      
      setIsPlaying(true);
      
      audioRef.current.play()
        .then(() => {
          // Success - audio is playing
        })
        .catch((err) => {
          console.warn('Audio play failed (user interaction may be required):', err);
          setError('Audio play failed - user interaction required');
          setIsPlaying(false);
        });
    } catch (err) {
      console.error('Error setting up audio:', err);
      setError('Error setting up audio');
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