import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneCall, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  ChevronUp,
  ChevronDown,
  User,
  Users,
  Zap,
  Settings,
  Bell
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AdminCall {
  id: string;
  discord_username: string;
  caller_roblox_username: string;
  suspect_roblox_username: string;
  suspect_avatar_url?: string;
  reason_category: string;
  reason_description: string;
  time_remaining_seconds: number;
  created_at: string;
  expires_at: string;
}

interface AdminPreferences {
  sound_enabled: boolean;
  sound_type: string;
  sound_volume: number;
  show_portable_panel: boolean;
  panel_position: string;
  quick_responses: string[];
}

const FloatingAdminPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [calls, setCalls] = useState<AdminCall[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [preferences, setPreferences] = useState<AdminPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  
  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedCallIds = useRef<Set<string>>(new Set());
  const lastCallCount = useRef(0);

  // Check if user is admin/mod
  const isAdminUser = isAdmin || (user && (user as any).trust_level >= 2);

  useEffect(() => {
    if (!isAdminUser || !user) return;

    initializePanel();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('floating_admin_panel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'admin_call_alerts' },
        handleCallUpdate
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'admin_availability' },
        checkAdminStatus
      )
      .subscribe();

    // Auto-refresh every 15 seconds
    const refreshInterval = setInterval(fetchActiveCalls, 15000);

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [isAdminUser, user]);

  useEffect(() => {
    // Handle sound alerts for new calls
    if (calls.length > lastCallCount.current && preferences?.sound_enabled && soundEnabled) {
      const newCalls = calls.filter(call => !playedCallIds.current.has(call.id));
      
      if (newCalls.length > 0) {
        playAlertSound();
        newCalls.forEach(call => playedCallIds.current.add(call.id));
      }
    }
    
    lastCallCount.current = calls.length;
  }, [calls, preferences, soundEnabled]);

  const initializePanel = async () => {
    await Promise.all([
      loadPreferences(),
      checkAdminStatus(),
      fetchActiveCalls()
    ]);
    
    // Initialize audio
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
  };

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_admin_preferences', {
        admin_user_id: user.id
      });

      if (error) throw error;
      
      if (data) {
        setPreferences(data);
        setSoundEnabled(data.sound_enabled);
      }
    } catch (err) {
      console.error('Error loading admin preferences:', err);
    }
  };

  const updatePreferences = async (newPrefs: Partial<AdminPreferences>) => {
    if (!user || !preferences) return;

    try {
      const updated = { ...preferences, ...newPrefs };
      
      const { error } = await supabase
        .from('admin_preferences')
        .upsert({
          user_id: user.id,
          sound_enabled: updated.sound_enabled,
          sound_type: updated.sound_type,
          sound_volume: updated.sound_volume,
          show_portable_panel: updated.show_portable_panel,
          panel_position: updated.panel_position,
          quick_responses: updated.quick_responses,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      setPreferences(updated);
      if ('sound_enabled' in newPrefs) {
        setSoundEnabled(newPrefs.sound_enabled!);
      }
    } catch (err) {
      console.error('Error updating preferences:', err);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('admin_availability')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      setIsActive(data?.is_active || false);
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  const fetchActiveCalls = async () => {
    try {
      const { data, error } = await supabase.rpc('get_portable_panel_calls');

      if (error) throw error;
      setCalls(data || []);
    } catch (err) {
      console.error('Error fetching active calls:', err);
    }
  };

  const handleCallUpdate = () => {
    fetchActiveCalls();
  };

  const playAlertSound = () => {
    if (!audioRef.current || !preferences) return;

    try {
      const soundFile = preferences.sound_type === 'siren' 
        ? '/sounds/siren.mp3'
        : preferences.sound_type === 'chime'
        ? '/sounds/chime.mp3'
        : preferences.sound_type === 'bell'
        ? '/sounds/bell.mp3'
        : '/sounds/default.mp3';

      audioRef.current.src = soundFile;
      audioRef.current.volume = preferences.sound_volume;
      audioRef.current.play().catch(err => {
        console.warn('Could not play alert sound:', err);
      });
    } catch (err) {
      console.error('Error playing alert sound:', err);
    }
  };

  const handleCall = async (callId: string, action: 'handled' | 'ignored', message?: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const response = message || (action === 'handled' ? 'Handled from portable panel' : 'Ignored from portable panel');
      
      const { error } = await supabase.rpc('handle_call_with_response', {
        p_call_id: callId,
        p_admin_id: user.id,
        p_action: action,
        p_response_message: response,
        p_interaction_source: 'portable_panel'
      });

      if (error) throw error;
      
      // Remove from local state immediately for better UX
      setCalls(prev => prev.filter(call => call.id !== callId));
    } catch (err) {
      console.error('Error handling call:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'EXPIRED';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const reasonLabels = {
    hacking: 'Hacking',
    exploiting: 'Exploiting', 
    griefing: 'Griefing',
    toxicity: 'Toxic',
    other: 'Other'
  };

  // Don't show panel if user is not admin/mod or preferences say to hide it
  if (!isAdminUser || !isActive || (preferences && !preferences.show_portable_panel)) {
    return null;
  }

  const activeCalls = calls.filter(call => call.time_remaining_seconds > 0);
  const urgentCalls = activeCalls.filter(call => call.time_remaining_seconds < 60);
  const hasUrgentCalls = urgentCalls.length > 0;

  return (
    <>
      {/* Floating Bubble */}
      <div className="fixed bottom-20 right-6 z-50">
        <div className="relative">
          {/* Main Bubble */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
              relative flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-all duration-300 
              ${hasUrgentCalls 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-blue-500 hover:bg-blue-600'
              } text-white transform hover:scale-110
            `}
            title={`${activeCalls.length} active admin calls`}
          >
            <PhoneCall size={24} />
            
            {/* Call Count Badge */}
            {activeCalls.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold animate-bounce">
                {activeCalls.length}
              </div>
            )}
            
            {/* Urgent Indicator */}
            {hasUrgentCalls && (
              <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
            )}
          </button>

          {/* Quick Stats */}
          {activeCalls.length > 0 && !isExpanded && (
            <div className="absolute bottom-full right-0 mb-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {activeCalls.length} active • Next expires: {formatTimeRemaining(Math.min(...activeCalls.map(c => c.time_remaining_seconds)))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="fixed bottom-40 right-6 z-40 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="text-blue-600" size={18} />
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Admin Calls ({activeCalls.length})
                </h3>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Sound Toggle */}
                <button
                  onClick={() => updatePreferences({ sound_enabled: !soundEnabled })}
                  className={`p-1 rounded transition-colors ${
                    soundEnabled 
                      ? 'text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                
                {/* Settings */}
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Panel settings"
                >
                  <Settings size={16} />
                </button>
                
                {/* Full Dashboard Link */}
                <a
                  href="/admin"
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Open full dashboard"
                >
                  <ExternalLink size={16} />
                </a>
                
                {/* Collapse */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Preferences Panel */}
          {showPreferences && preferences && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Sound Type</label>
                  <select
                    value={preferences.sound_type}
                    onChange={(e) => updatePreferences({ sound_type: e.target.value })}
                    className="text-xs px-2 py-1 border rounded dark:bg-gray-600 dark:border-gray-500"
                  >
                    <option value="default">Default</option>
                    <option value="chime">Chime</option>
                    <option value="bell">Bell</option>
                    <option value="siren">Siren</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Volume</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={preferences.sound_volume}
                    onChange={(e) => updatePreferences({ sound_volume: parseFloat(e.target.value) })}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Calls List */}
          <div className="max-h-64 overflow-y-auto">
            {activeCalls.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <CheckCircle className="mx-auto mb-2" size={24} />
                <p className="text-sm">No active calls</p>
                <p className="text-xs">All clear!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeCalls.map((call) => {
                  const isUrgent = call.time_remaining_seconds < 60;
                  
                  return (
                    <div
                      key={call.id}
                      className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        isUrgent ? 'border-l-2 border-red-500 bg-red-50 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User size={12} />
                            <span className="text-xs font-medium truncate">
                              {call.discord_username}
                            </span>
                            <span className={`text-xs font-mono px-1 rounded ${
                              isUrgent ? 'bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                            }`}>
                              {formatTimeRemaining(call.time_remaining_seconds)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <Users size={10} />
                            <span className="truncate">Join: {call.caller_roblox_username}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            {call.suspect_avatar_url && (
                              <img
                                src={call.suspect_avatar_url}
                                alt="Suspect"
                                className="w-4 h-4 rounded-full"
                              />
                            )}
                            <span className="text-xs font-medium">
                              {call.suspect_roblox_username}
                            </span>
                            <span className="px-1 py-0.5 bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 rounded text-xs">
                              {reasonLabels[call.reason_category as keyof typeof reasonLabels]}
                            </span>
                          </div>
                          
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {call.reason_description}
                          </p>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleCall(call.id, 'handled')}
                          disabled={loading}
                          className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-xs py-1 px-2 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <CheckCircle size={10} />
                          Handle
                        </button>
                        <button
                          onClick={() => handleCall(call.id, 'ignored')}
                          disabled={loading}
                          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white text-xs py-1 px-2 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <XCircle size={10} />
                          Ignore
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{activeCalls.length} active calls</span>
              {urgentCalls.length > 0 && (
                <span className="text-red-600 font-medium">{urgentCalls.length} urgent</span>
              )}
              <span className="text-green-600">● Live</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingAdminPanel; 