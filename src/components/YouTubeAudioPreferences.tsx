import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import YouTubeAudioService from '../services/youtubeAudioService';

interface YouTubeAudioPreferencesProps {
  userId: string;
  onSettingsChange: (settings: any) => void;
}

const YouTubeAudioPreferences: React.FC<YouTubeAudioPreferencesProps> = ({ 
  userId, 
  onSettingsChange 
}) => {
  const [youtubeEnabled, setYoutubeEnabled] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadYouTubeSettings();
  }, [userId]);

  const loadYouTubeSettings = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_preferences', {
        admin_user_id: userId
      });

      if (error) throw error;

      if (data) {
        setYoutubeEnabled(data.youtube_audio_enabled || false);
        setVideoUrl(data.youtube_video_url || '');
        setDuration(data.youtube_audio_duration || 3);
      }
    } catch (err) {
      console.error('Error loading YouTube settings:', err);
      setError('Failed to load YouTube settings');
    }
  };

  const saveYouTubeSettings = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate YouTube URL
      if (youtubeEnabled && videoUrl) {
        if (!YouTubeAudioService.validateYouTubeUrl(videoUrl)) {
          throw new Error('Invalid YouTube URL format');
        }
      }

      const { error } = await supabase.rpc('update_youtube_audio_settings', {
        p_user_id: userId,
        p_youtube_audio_enabled: youtubeEnabled,
        p_youtube_video_url: videoUrl,
        p_youtube_audio_duration: duration
      });

      if (error) throw error;

      setSuccess('YouTube audio settings saved successfully!');
      onSettingsChange({ youtubeEnabled, videoUrl, duration });
    } catch (err: any) {
      console.error('Error saving YouTube settings:', err);
      setError(err.message || 'Failed to save YouTube settings');
    } finally {
      setIsLoading(false);
    }
  };

  const testYouTubeAudio = async () => {
    if (!videoUrl) {
      setError('Please enter a YouTube URL first');
      return;
    }

    setIsTesting(true);
    setError(null);

    try {
      const videoId = YouTubeAudioService.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Test using embedded YouTube player
      await YouTubeAudioService.testYouTubeAudio(videoId, duration);
      setSuccess('YouTube audio test successful!');
    } catch (err: any) {
      console.error('YouTube audio test failed:', err);
      setError('Failed to test YouTube audio - make sure the video is available');
    } finally {
      setIsTesting(false);
    }
  };

  const getVideoInfo = async () => {
    if (!videoUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      const videoId = YouTubeAudioService.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await YouTubeAudioService.getVideoInfo(videoId);
      setVideoInfo(info);
    } catch (err: any) {
      console.error('Failed to get video info:', err);
      setError(err.message || 'Failed to get video information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
    setVideoInfo(null);
    setError(null);
    
    // Auto-fetch video info when URL changes
    if (url && YouTubeAudioService.validateYouTubeUrl(url)) {
      getVideoInfo();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium">YouTube Audio</h4>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={youtubeEnabled}
            onChange={(e) => setYoutubeEnabled(e.target.checked)}
            className="form-checkbox mr-2"
          />
          <span className="text-sm">Enable YouTube audio</span>
        </label>
      </div>

      {youtubeEnabled && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-2">
              YouTube Video URL
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => handleVideoUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: youtube.com/watch?v=..., youtu.be/...
            </p>
          </div>

          {videoInfo && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="text-blue-600" size={16} />
                <span className="font-medium text-sm">Video Info</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Title:</strong> {videoInfo.title}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Duration:</strong> {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              Audio Duration (seconds)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1s</span>
              <span>{duration}s</span>
              <span>10s</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={testYouTubeAudio}
              disabled={!videoUrl || isTesting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded transition-colors"
            >
              {isTesting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              {isTesting ? 'Testing...' : 'Test Audio'}
            </button>

            <button
              onClick={saveYouTubeSettings}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded transition-colors"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <CheckCircle size={16} />
              )}
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <AlertCircle className="text-red-600" size={16} />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
              <CheckCircle className="text-green-600" size={16} />
              <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeAudioPreferences; 