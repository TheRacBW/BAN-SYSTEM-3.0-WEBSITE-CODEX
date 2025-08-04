import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  Upload, 
  Plus, 
  X, 
  CheckCircle, 
  Clock,
  ExternalLink,
  Image,
  Video,
  Users,
  Flag,
  User,
  Search,
  Loader,
  ExternalLink as ExternalLinkIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useReportRestrictions } from '../hooks/useReportRestrictions';

interface RobloxPlayer {
  userId: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  accountCreated?: string;
}

interface VideoTimestamp {
  timestamp: string; // e.g., "1:23"
  description: string;
  url: string; // YouTube URL with timestamp
}

interface ReportFormData {
  reason: string;
  youtubeUrl: string;
  matchHistoryUrl: string;
  reportedPlayers: (RobloxPlayer & { isPrimarySuspect: boolean })[];
  videoTimestamps: VideoTimestamp[];
  multipleViolators: boolean;
  additionalNotes: string;
}

const ReportSubmissionForm: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ReportFormData>({
    reason: '',
    youtubeUrl: '',
    matchHistoryUrl: '',
    reportedPlayers: [],
    videoTimestamps: [],
    multipleViolators: false,
    additionalNotes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isDiscordVerified, setIsDiscordVerified] = useState(false);
  const [playerSearchInput, setPlayerSearchInput] = useState('');
  const [searchingPlayer, setSearchingPlayer] = useState(false);
  const [timestampInput, setTimestampInput] = useState({ timestamp: '', description: '' });
  const [matchHistoryImageError, setMatchHistoryImageError] = useState(false);

  // Report restrictions hook
  const { canSubmit: canSubmitReports, restrictionMessage, loading: restrictionsLoading } = useReportRestrictions();

  const reasonOptions = [
    { value: 'hacking/exploiting', label: 'Hacking/Exploiting' },
    { value: 'queue_dodging', label: 'Queue Dodging' },
    { value: 'glitch_abusing', label: 'Glitch Abusing' },
    { value: 'alt_farming', label: 'Alt Farming' },
    { value: 'hate_speech', label: 'Hate Speech' },  
    { value: 'hate_building', label: 'Hate Building' }
  ];

  useEffect(() => {
    checkDiscordVerification();
  }, [user]);

  useEffect(() => {
    // Only check eligibility after Discord verification is determined and restrictions are loaded
    if (isDiscordVerified !== null && !restrictionsLoading) {
      checkSubmissionEligibility();
    }
  }, [user, isDiscordVerified, canSubmitReports, restrictionsLoading]);

  useEffect(() => {
    // Clear error messages after 5 seconds
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Reset image error when URL changes
  useEffect(() => {
    setMatchHistoryImageError(false);
  }, [formData.matchHistoryUrl]);

  const checkDiscordVerification = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('users')
        .select('discord_verified_at')
        .eq('id', user.id)
        .single();
      
      const verified = !!data?.discord_verified_at;
      setIsDiscordVerified(verified);
    } catch (err) {
      console.error('Error checking Discord verification:', err);
      setIsDiscordVerified(false);
    }
  };

  const checkSubmissionEligibility = async () => {
    if (!user) return;

    try {
      setCanSubmit((canSubmitReports ?? false) && isDiscordVerified);
    } catch (err) {
      console.error('Error checking submission eligibility:', err);
      setCanSubmit(false);
    }
  };

  const searchRobloxPlayer = async (input: string) => {
    if (!input.trim()) {
      setError('Please enter a username or user ID');
      return;
    }
    
    setSearchingPlayer(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('find-reported-player', {
        body: { input: input.trim() }
      });

      if (error) throw error;

      if (data?.success && data?.player) {
        const player = data.player;

        // Check if player already added
        if (formData.reportedPlayers.find(p => p.userId === player.userId)) {
          setError('Player already added to report');
          return;
        }
        
          if (formData.reportedPlayers.length >= 5) {
            setError('Maximum of 5 players can be reported per case');
            return;
          }
        
        const newPlayer = {
          ...player,
          isPrimarySuspect: formData.reportedPlayers.length === 0 // First player is primary by default
        };
          
          setFormData(prev => ({
            ...prev,
            reportedPlayers: [...prev.reportedPlayers, newPlayer]
          }));
        
          setPlayerSearchInput('');
      } else {
        setError(data?.error || 'Player not found. Please check the username or user ID.');
      }
    } catch (err) {
      console.error('Error searching player:', err);
      setError('Failed to search for player. Please try again.');
    } finally {
      setSearchingPlayer(false);
    }
  };

  const removePlayer = (userId: number) => {
    const updatedPlayers = formData.reportedPlayers.filter(p => p.userId !== userId);
    
    // If we removed the primary suspect, make the first remaining player primary
    if (updatedPlayers.length > 0 && !updatedPlayers.find(p => p.isPrimarySuspect)) {
      updatedPlayers[0].isPrimarySuspect = true;
    }
    
    setFormData(prev => ({
      ...prev,
      reportedPlayers: updatedPlayers
    }));
  };

  const setPrimarySuspect = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      reportedPlayers: prev.reportedPlayers.map(player => ({
        ...player,
        isPrimarySuspect: player.userId === userId
      }))
    }));
  };

  const getYouTubeVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match?.[1] || null;
  };

  const addTimestamp = () => {
    if (!timestampInput.timestamp.trim() || !timestampInput.description.trim()) {
      setError('Please provide both timestamp and description');
      return;
    }

    // Validate timestamp format (MM:SS or H:MM:SS)
    const timeRegex = /^(\d{1,2}:)?\d{1,2}:\d{2}$|^\d{1,2}:\d{2}$/;
    if (!timeRegex.test(timestampInput.timestamp)) {
      setError('Invalid timestamp format. Use MM:SS or H:MM:SS');
      return;
    }

    const videoId = getYouTubeVideoId(formData.youtubeUrl);
    if (!videoId) {
      setError('Please add a valid YouTube URL first');
      return;
    }

    // Convert timestamp to seconds for YouTube URL
    const parts = timestampInput.timestamp.split(':');
    let seconds = 0;
    if (parts.length === 2) {
      seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
      seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }

    const timestampUrl = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;

    const newTimestamp: VideoTimestamp = {
      timestamp: timestampInput.timestamp,
      description: timestampInput.description,
      url: timestampUrl
    };

    setFormData(prev => ({
      ...prev,
      videoTimestamps: [...prev.videoTimestamps, newTimestamp]
    }));

    setTimestampInput({ timestamp: '', description: '' });
    setError(null);
  };

  const removeTimestamp = (index: number) => {
    setFormData(prev => ({
      ...prev,
      videoTimestamps: prev.videoTimestamps.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!formData.reason) {
      setError('Please select a reason for the report');
      return false;
    }

    if (!formData.youtubeUrl.trim()) {
      setError('YouTube video link is required');
      return false;
    }

    if (!getYouTubeVideoId(formData.youtubeUrl)) {
      setError('Please provide a valid YouTube URL');
      return false;
    }

    if (!formData.matchHistoryUrl.trim()) {
      setError('Match history image is required');
      return false;
    }

    if (formData.reportedPlayers.length === 0) {
      setError('At least one player must be reported');
      return false;
    }

    if (!isDiscordVerified) {
      setError('Discord verification is required to submit reports');
      return false;
    }

    return true;
  };

  const submitReport = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare reported players data
      const reportedPlayersData = formData.reportedPlayers.map(player => ({
        user_id: player.userId,
        username: player.username,
        is_primary_suspect: player.isPrimarySuspect,
        roblox_avatar_url: player.avatarUrl,
        display_name: player.displayName,
        is_verified: player.isVerified
      }));

      const primarySuspect = formData.reportedPlayers.find(p => p.isPrimarySuspect);

      const { error } = await supabase
        .from('admin_report_cases')
        .insert({
          submitted_by: user?.id,
          discord_username: user?.email?.split('@')[0] || 'Unknown',
          reason: formData.reason,
          youtube_video_url: formData.youtubeUrl,
          match_history_image_url: formData.matchHistoryUrl,
          reported_players: reportedPlayersData,
          primary_suspect_user_id: primarySuspect?.userId || null,
          video_timestamps: formData.videoTimestamps,
          review_notes: formData.additionalNotes
        });

      if (error) throw error;

      setSuccess('Report submitted successfully! Our anti-cheat moderators will review it soon. You can check the status in your account dashboard.');
      
      // Reset form
      setFormData({
        reason: '',
        youtubeUrl: '',
        matchHistoryUrl: '',
        reportedPlayers: [],
        videoTimestamps: [],
        multipleViolators: false,
        additionalNotes: ''
      });
      setTimestampInput({ timestamp: '', description: '' });
      setMatchHistoryImageError(false);
      
    } catch (err) {
      console.error('Error submitting report:', err);
      setError('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Authentication Required
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Please sign in to submit a report.
        </p>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="text-center py-8">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {!isDiscordVerified ? 'Discord Verification Required' : 'Report Submission Restricted'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {!isDiscordVerified 
            ? 'You must verify your Discord account to submit reports.'
            : restrictionMessage || 'You are currently restricted from submitting reports.'}
        </p>
        {restrictionMessage && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              {restrictionMessage}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Submit Report</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Report cheaters, exploiters, and rule violators to our anti-cheat team
          </p>
        </div>

      {/* Important Guidelines */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <h3 className="font-semibold mb-2">Important Guidelines:</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Show the exploiter's username clearly in the video</li>
              <li>Match history screenshot is REQUIRED - tickets without it are invalid</li>
              <li>Submit only ONE cheater per ticket</li>
              <li>Videos longer than 1 minute MUST include timestamps</li>
              <li>If your ticket isn't responded to, please don't ping anyone - we'll handle it when we have time</li>
            </ul>
          </div>
          </div>
        </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 space-y-6">
          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Flag className="inline mr-2" size={16} />
              Report Reason *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a reason...</option>
              {reasonOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* YouTube Video URL */}
              <div>
            <label className="block text-sm font-medium mb-2">
              <Video className="inline mr-2" size={16} />
              YouTube Video Evidence *
            </label>
                <input
                  type="url"
                  value={formData.youtubeUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            
            {/* YouTube Preview */}
            {formData.youtubeUrl && getYouTubeVideoId(formData.youtubeUrl) && (
              <div className="mt-3">
                <iframe
                  width="100%"
                  height="250"
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(formData.youtubeUrl)}`}
                  title="Evidence Video Preview"
                  frameBorder="0"
                  allowFullScreen
                  className="rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Match History Image */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Image className="inline mr-2" size={16} />
              Match History Evidence *
            </label>
            <input
              type="url"
              value={formData.matchHistoryUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, matchHistoryUrl: e.target.value }))}
              placeholder="https://example.com/image.png or imgur.com/..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            
            {/* Image Preview */}
            {formData.matchHistoryUrl && (
              <div className="mt-3">
                {!matchHistoryImageError ? (
                  <img 
                    src={formData.matchHistoryUrl} 
                    alt="Match History Preview"
                    className="max-w-full h-auto max-h-96 rounded-lg border border-gray-200 dark:border-gray-600 object-contain"
                    onError={() => setMatchHistoryImageError(true)}
                    onLoad={() => setMatchHistoryImageError(false)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-red-700 dark:text-red-300 text-sm">
                      Unable to load image. Please check the URL and try again.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Player Search */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Users className="inline mr-2" size={16} />
              Search & Add Players *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={playerSearchInput}
                onChange={(e) => setPlayerSearchInput(e.target.value)}
                placeholder="Enter Roblox username or user ID"
                className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchRobloxPlayer(playerSearchInput);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => searchRobloxPlayer(playerSearchInput)}
                disabled={searchingPlayer || !playerSearchInput.trim()}
                className="btn btn-primary px-4 py-3 flex items-center gap-2"
              >
                {searchingPlayer ? (
                  <Loader className="animate-spin" size={16} />
                ) : (
                  <Search size={16} />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Added Players */}
          {formData.reportedPlayers.length > 0 && (
              <div>
              <label className="block text-sm font-medium mb-2">
                Reported Players ({formData.reportedPlayers.length}/5)
              </label>
              <div className="space-y-3">
                {formData.reportedPlayers.map((player) => (
                  <div key={player.userId} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border">
                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                      {player.avatarUrl ? (
                        <img 
                          src={player.avatarUrl} 
                          alt={player.username}
                          className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      {(!player.avatarUrl || player.avatarUrl === '') && (
                        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <User size={20} className="text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {player.displayName || player.username}
                        </span>
                        <span className="text-sm text-gray-500">@{player.username}</span>
                        {player.isVerified && (
                          <Shield size={14} className="text-green-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {player.userId}
                        {player.accountCreated && (
                          <span className="ml-2">
                            • Created: {new Date(player.accountCreated).toLocaleDateString()}
                      </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Roblox Profile Link */}
                      <a
                        href={`https://www.roblox.com/users/${player.userId}/profile`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 p-1"
                        title="View Roblox Profile"
                      >
                        <ExternalLinkIcon size={16} />
                      </a>
                      
                      <button
                        type="button"
                        onClick={() => setPrimarySuspect(player.userId)}
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          player.isPrimarySuspect
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-700'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                        }`}
                      >
                        {player.isPrimarySuspect ? 'Primary Suspect' : 'Set as Primary'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlayer(player.userId)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Timestamps */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Clock className="inline mr-2" size={16} />
              Video Timestamps
            </label>
            <div className="space-y-3">
              {formData.videoTimestamps.map((timestamp, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                    {timestamp.timestamp}
                  </span>
                  <span className="text-sm flex-1">{timestamp.description}</span>
                  <a
                    href={timestamp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 p-1"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeTimestamp(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <X size={14} />
                      </button>
                    </div>
                  ))}
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={timestampInput.timestamp}
                      onChange={(e) => setTimestampInput({ ...timestampInput, timestamp: e.target.value })}
                      placeholder="1:23"
                      className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    />
                    <input
                      type="text"
                      value={timestampInput.description}
                      onChange={(e) => setTimestampInput({ ...timestampInput, description: e.target.value })}
                      placeholder="Description of violation"
                      className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    />
                    <button
                      type="button"
                      onClick={addTimestamp}
                  className="btn btn-primary px-3 py-2"
                    >
                  <Plus size={14} />
                    </button>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.additionalNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
              placeholder="Any additional context or information..."
              rows={3}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={submitReport}
              disabled={loading}
              className="btn btn-primary px-8 py-3 text-lg flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag size={20} />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

        {/* Alerts */}
        {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} />
              {error}
            </div>
          </div>
        )}

        {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} />
              {success}
            </div>
          </div>
        )}
    </div>
  );
};

export default ReportSubmissionForm; 