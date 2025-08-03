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
  MessageSquare,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface RobloxPlayer {
  userId: number;
  username: string;
  avatarUrl?: string;
  isVerified?: boolean;
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
  reportedPlayers: RobloxPlayer[];
  primarySuspectUserId: number | null;
  videoTimestamps: VideoTimestamp[];
  multipleViolators: boolean;
}

const ReportSubmissionForm: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ReportFormData>({
    reason: '',
    youtubeUrl: '',
    matchHistoryUrl: '',
    reportedPlayers: [],
    primarySuspectUserId: null,
    videoTimestamps: [],
    multipleViolators: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isDiscordVerified, setIsDiscordVerified] = useState(false);
  const [playerSearchInput, setPlayerSearchInput] = useState('');
  const [searchingPlayer, setSearchingPlayer] = useState(false);
  const [timestampInput, setTimestampInput] = useState({ timestamp: '', description: '' });

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
    checkSubmissionEligibility();
  }, [user]);

  const checkDiscordVerification = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('users')
        .select('discord_verified_at')
        .eq('id', user.id)
        .single();
      
      setIsDiscordVerified(!!data?.discord_verified_at);
    } catch (err) {
      console.error('Error checking Discord verification:', err);
    }
  };

  const checkSubmissionEligibility = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('can_user_submit_reports', {
        user_uuid: user.id
      });

      if (error) throw error;
      setCanSubmit(data && isDiscordVerified);
    } catch (err) {
      console.error('Error checking submission eligibility:', err);
      setCanSubmit(false);
    }
  };

  const searchRobloxPlayer = async (input: string) => {
    if (!input.trim()) return;
    
    setSearchingPlayer(true);
    try {
      // First check if it's a user ID (numeric)
      const isUserId = /^\d+$/.test(input.trim());
      
      const { data, error } = await supabase.functions.invoke('find-user-id', {
        body: { 
          [isUserId ? 'userId' : 'username']: input.trim() 
        }
      });

      if (error) throw error;

      if (data?.userId && data?.username) {
        const newPlayer: RobloxPlayer = {
          userId: data.userId,
          username: data.username,
          avatarUrl: data.avatarUrl,
          isVerified: data.isVerified
        };

        // Check if player already added
        if (!formData.reportedPlayers.find(p => p.userId === newPlayer.userId)) {
          if (formData.reportedPlayers.length >= 5) {
            setError('Maximum of 5 players can be reported per case');
            return;
          }
          
          setFormData(prev => ({
            ...prev,
            reportedPlayers: [...prev.reportedPlayers, newPlayer]
          }));
          setPlayerSearchInput('');
        } else {
          setError('Player already added to report');
        }
      } else {
        setError('Player not found. Please check the username or user ID.');
      }
    } catch (err) {
      console.error('Error searching player:', err);
      setError('Failed to search for player');
    } finally {
      setSearchingPlayer(false);
    }
  };

  const removePlayer = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      reportedPlayers: prev.reportedPlayers.filter(p => p.userId !== userId),
      primarySuspectUserId: prev.primarySuspectUserId === userId ? null : prev.primarySuspectUserId
    }));
  };

  const setPrimarySuspect = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      primarySuspectUserId: prev.primarySuspectUserId === userId ? null : userId
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
  };

  const removeTimestamp = (index: number) => {
    setFormData(prev => ({
      ...prev,
      videoTimestamps: prev.videoTimestamps.filter((_, i) => i !== index)
    }));
  };

  const generateSimpleCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;
    return { question: `${num1} + ${num2} = ?`, answer: answer.toString() };
  };

  const [captcha] = useState(generateSimpleCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');

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

    if (formData.reportedPlayers.length > 1 && !formData.primarySuspectUserId) {
      setError('Please select a primary suspect when reporting multiple players');
      return false;
    }

    if (formData.videoTimestamps.length === 0) {
      setError('At least one video timestamp is required');
      return false;
    }

    if (captchaAnswer !== captcha.answer) {
      setError('Incorrect captcha answer');
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
        is_primary_suspect: player.userId === formData.primarySuspectUserId,
        roblox_avatar_url: player.avatarUrl
      }));

      const { error } = await supabase
        .from('admin_report_cases')
        .insert({
          submitted_by: user?.id,
          discord_username: user?.email?.split('@')[0] || 'Unknown', // This should be the actual Discord username
          reason: formData.reason,
          youtube_video_url: formData.youtubeUrl,
          match_history_image_url: formData.matchHistoryUrl,
          reported_players: reportedPlayersData,
          primary_suspect_user_id: formData.primarySuspectUserId,
          video_timestamps: formData.videoTimestamps
        });

      if (error) throw error;

      setSuccess('Report submitted successfully! Our anti-cheat moderators will review it soon.');
      
      // Reset form
      setFormData({
        reason: '',
        youtubeUrl: '',
        matchHistoryUrl: '',
        reportedPlayers: [],
        primarySuspectUserId: null,
        videoTimestamps: [],
        multipleViolators: false
      });
      setCaptchaAnswer('');
      
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
          {!isDiscordVerified ? 'Discord Verification Required' : 'Temporarily Restricted'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {!isDiscordVerified 
            ? 'You must verify your Discord account to submit reports.'
            : 'You are temporarily restricted from submitting reports due to previous false reports.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center mb-8">
          <Flag className="mx-auto h-12 w-12 text-primary-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Submit Anti-Cheat Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Help us maintain a fair gaming environment by reporting violations
          </p>
        </div>

        {/* Discord Verification Status */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="text-green-600" size={20} />
            <span className="text-green-800 dark:text-green-200 font-medium">
              Discord Verified ✓
            </span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submitReport(); }} className="space-y-6">
          {/* Report Reason */}
          <div className="panel">
            <h3 className="panel-title flex items-center gap-2">
              <Flag size={18} />
              Violation Type
            </h3>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            >
              <option value="">Select violation type...</option>
              {reasonOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Video Evidence */}
          <div className="panel">
            <h3 className="panel-title flex items-center gap-2">
              <Video size={18} />
              Video Evidence (Required)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">YouTube Video URL</label>
                <input
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Provide a link to YouTube or Medal video showing the violation
                </p>
              </div>

              {/* Video Timestamps */}
              <div>
                <label className="block text-sm font-medium mb-2">Video Timestamps</label>
                <div className="space-y-2">
                  {formData.videoTimestamps.map((timestamp, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        {timestamp.timestamp}
                      </span>
                      <span className="text-sm flex-1">{timestamp.description}</span>
                      <button
                        type="button"
                        onClick={() => removeTimestamp(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
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
                      className="btn btn-primary px-4 py-2"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Match History Image */}
          <div className="panel">
            <h3 className="panel-title flex items-center gap-2">
              <Image size={18} />
              Match History Evidence (Required)
            </h3>
            <input
              type="url"
              value={formData.matchHistoryUrl}
              onChange={(e) => setFormData({ ...formData, matchHistoryUrl: e.target.value })}
              placeholder="https://example.com/match-history-image.png"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Provide a link to an image showing the match history or relevant evidence
            </p>
          </div>

          {/* Reported Players */}
          <div className="panel">
            <h3 className="panel-title flex items-center gap-2">
              <Users size={18} />
              Reported Players
            </h3>
            <div className="space-y-4">
              {/* Player Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Search Player</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playerSearchInput}
                    onChange={(e) => setPlayerSearchInput(e.target.value)}
                    placeholder="Enter Roblox username or user ID"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => searchRobloxPlayer(playerSearchInput)}
                    disabled={searchingPlayer || !playerSearchInput.trim()}
                    className="btn btn-primary px-4 py-3"
                  >
                    {searchingPlayer ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
              </div>

              {/* Added Players */}
              <div>
                <label className="block text-sm font-medium mb-2">Reported Players ({formData.reportedPlayers.length}/5)</label>
                <div className="space-y-2">
                  {formData.reportedPlayers.map((player, index) => (
                    <div key={player.userId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {player.avatarUrl && (
                        <img 
                          src={player.avatarUrl} 
                          alt={player.username}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{player.username}</span>
                          {player.isVerified && (
                            <Shield size={14} className="text-green-500" title="Verified" />
                          )}
                        </div>
                        <span className="text-sm text-gray-500">ID: {player.userId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPrimarySuspect(player.userId)}
                          className={`px-3 py-1 rounded text-sm ${
                            formData.primarySuspectUserId === player.userId
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {formData.primarySuspectUserId === player.userId ? 'Primary' : 'Set Primary'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePlayer(player.userId)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Captcha */}
          <div className="panel">
            <h3 className="panel-title flex items-center gap-2">
              <Shield size={18} />
              Verification
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Security Check</label>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                    {captcha.question}
                  </span>
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Answer"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary px-8 py-3 text-lg"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Flag size={20} />
                  Submit Report
                </div>
              )}
            </button>
          </div>
        </form>

        {/* Alerts */}
        {error && (
          <div className="mt-6 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} />
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="mt-6 bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-700 dark:text-green-300 px-4 py-3 rounded">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} />
              {success}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportSubmissionForm; 