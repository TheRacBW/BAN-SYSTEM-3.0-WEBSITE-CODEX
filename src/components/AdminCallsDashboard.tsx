import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  AlertTriangle,
  User,
  Users,
  Image,
  ExternalLink,
  Shield,
  ToggleLeft,
  ToggleRight,
  History,
  Flag,
  Calendar,
  Timer,
  Zap,
  MessageSquare,
  FileText,
  Camera,
  X,
  Loader
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AdminCall {
  id: string;
  submitted_by: string;
  discord_username: string;
  caller_roblox_username: string;
  suspect_roblox_username: string;
  suspect_user_id?: number;
  suspect_avatar_url?: string;
  reason_category: string;
  reason_description: string;
  proof_image_url?: string;
  status: string;
  handled_by?: string;
  handled_at?: string;
  archive_reason?: string;
  expires_at: string;
  created_at: string;
  submitter?: {
    username: string;
    discord_verified_at?: string;
  };
  handler?: {
    username: string;
  };
}

interface SuspicionLogEntry {
  id: string;
  suspect_user_id: number;
  suspect_username: string;
  source_type: string;
  reason: string;
  created_at: string;
  verified: boolean;
  false_positive: boolean;
}

const AdminCallsDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [calls, setCalls] = useState<AdminCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [selectedCall, setSelectedCall] = useState<AdminCall | null>(null);
  const [showSuspicionLog, setShowSuspicionLog] = useState(false);
  const [suspicionLog, setSuspicionLog] = useState<SuspicionLogEntry[]>([]);
  const [suspicionUserId, setSuspicionUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);

  const statusConfig = {
    active: { 
      label: 'Active', 
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      icon: Zap 
    },
    handled: { 
      label: 'Handled', 
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      icon: CheckCircle 
    },
    expired: { 
      label: 'Expired', 
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: Clock 
    },
    ignored: { 
      label: 'Ignored', 
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      icon: XCircle 
    },
    archived: { 
      label: 'Archived', 
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      icon: History 
    }
  };

  const reasonLabels = {
    hacking: 'Hacking/Cheating',
    exploiting: 'Exploiting',
    griefing: 'Griefing',
    toxicity: 'Toxic Behavior',
    other: 'Other'
  };

  useEffect(() => {
    if (user && (isAdmin || (user as any).trust_level >= 2)) {
      fetchCalls();
      checkAdminStatus();
      
      // Set up real-time subscription for new calls
      const callsSubscription = supabase
        .channel('admin_calls_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'admin_call_alerts' },
          fetchCalls
        )
        .subscribe();

      // Auto-refresh every 30 seconds to handle expiry
      const refreshInterval = setInterval(fetchCalls, 30000);

      return () => {
        callsSubscription.unsubscribe();
        clearInterval(refreshInterval);
      };
    }
  }, [user, isAdmin]);

  useEffect(() => {
    // Clear messages after 5 seconds
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
          
      const { data, error } = await supabase
        .from('admin_call_alerts')
        .select(`
          *,
          submitter:submitted_by(username, discord_verified_at),
          handler:handled_by(username)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCalls(data || []);
    } catch (err) {
      console.error('Error fetching calls:', err);
      setError('Failed to fetch admin calls');
    } finally {
      setLoading(false);
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

  const toggleActiveStatus = async () => {
    if (!user) return;

    try {
      const newStatus = !isActive;
      
      const { error } = await supabase
        .from('admin_availability')
        .upsert({
          user_id: user.id,
          is_active: newStatus,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setIsActive(newStatus);
      setSuccess(`You are now ${newStatus ? 'active' : 'inactive'} for admin calls`);
    } catch (err) {
      console.error('Error updating admin status:', err);
      setError('Failed to update status');
    }
  };

  const handleCall = async (callId: string, action: 'handled' | 'ignored', reason?: string) => {
    try {
      const { error } = await supabase
        .from('admin_call_alerts')
        .update({
          status: action,
          handled_by: user?.id,
          handled_at: new Date().toISOString(),
          archive_reason: reason || `Marked as ${action} by admin`,
          updated_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) throw error;

      setSuccess(`Call marked as ${action}`);
      fetchCalls();
      setShowCallModal(false);
    } catch (err) {
      console.error('Error handling call:', err);
      setError(`Failed to mark call as ${action}`);
    }
  };

  const fetchSuspicionLog = async (userId: number) => {
    try {
      const { data, error } = await supabase
        .from('suspicion_log')
        .select('*')
        .eq('suspect_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuspicionLog(data || []);
      setSuspicionUserId(userId);
      setShowSuspicionLog(true);
    } catch (err) {
      console.error('Error fetching suspicion log:', err);
      setError('Failed to fetch suspicion log');
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = Math.max(0, expiry.getTime() - now.getTime());
    
    if (diff === 0) return 'EXPIRED';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!user || (!isAdmin && (user as any).trust_level < 2)) {
    return (
      <div className="text-center py-8">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          You need admin or AC moderator privileges to access the admin calls dashboard.
        </p>
      </div>
    );
  }

  const activeCalls = calls.filter(c => c.status === 'active');
  const recentCalls = calls.filter(c => c.status !== 'active').slice(0, 10);

  // Call Detail Modal Component
  const CallDetailModal: React.FC<{ call: AdminCall }> = ({ call }) => {
    const [action, setAction] = useState<'handled' | 'ignored'>('handled');
    const [reason, setReason] = useState('');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <Phone className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Call Details</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Submitted by {call.discord_username} on {formatTime(call.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCallModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Call Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <User size={16} />
                    Caller Information
                  </h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Discord:</span> {call.discord_username}</p>
                    <p><span className="font-medium">Roblox Username:</span> {call.caller_roblox_username}</p>
                    {call.submitter?.discord_verified_at && (
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">Discord Verified</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Suspect Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {call.suspect_avatar_url && (
                        <img
                          src={call.suspect_avatar_url}
                          alt="Suspect avatar"
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-medium">{call.suspect_roblox_username}</span>
                    </div>
                    {call.suspect_user_id && (
                      <button
                        onClick={() => fetchSuspicionLog(call.suspect_user_id!)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <History size={14} />
                        View Suspicion History
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Shield size={16} />
                    Violation Details
                  </h3>
                  <div className="space-y-2">
                    <span className="px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 rounded text-sm">
                      {reasonLabels[call.reason_category as keyof typeof reasonLabels]}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {call.reason_description}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Clock size={16} />
                    Time Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Created:</span> {formatTime(call.created_at)}</p>
                    <p><span className="font-medium">Expires:</span> {formatTime(call.expires_at)}</p>
                    <p className={`font-mono ${getTimeRemaining(call.expires_at) === 'EXPIRED' ? 'text-red-600' : ''}`}>
                      <span className="font-medium">Time Remaining:</span> {getTimeRemaining(call.expires_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Proof Image */}
            {call.proof_image_url && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Camera size={16} />
                  Proof Image
                </h3>
                <img
                  src={call.proof_image_url}
                  alt="Proof"
                  className="max-w-full h-64 object-cover rounded border"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Call Actions */}
            {call.status === 'active' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="font-medium mb-4">Handle Call</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="handled"
                        checked={action === 'handled'}
                        onChange={(e) => setAction(e.target.value as 'handled' | 'ignored')}
                        className="text-blue-600"
                      />
                      <CheckCircle size={16} className="text-green-500" />
                      Mark as Handled
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="ignored"
                        checked={action === 'ignored'}
                        onChange={(e) => setAction(e.target.value as 'handled' | 'ignored')}
                        className="text-blue-600"
                      />
                      <XCircle size={16} className="text-red-500" />
                      Mark as Ignored
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      placeholder={`Reason for marking as ${action}...`}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCall(call.id, action, reason)}
                      className="btn btn-primary"
                    >
                      Confirm Action
                    </button>
                    <button
                      onClick={() => setShowCallModal(false)}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Suspicion Log Modal Component
  const SuspicionLogModal: React.FC = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="text-purple-500" size={24} />
                <div>
                  <h2 className="text-xl font-bold">Suspicion History</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    User ID: {suspicionUserId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuspicionLog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="p-6">
            {suspicionLog.length === 0 ? (
              <div className="text-center py-8">
                <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No Suspicion History
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  This user has no previous suspicion records.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {suspicionLog.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.suspect_username}</span>
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                          {entry.source_type}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {entry.reason}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={`px-2 py-1 rounded ${
                        entry.verified 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {entry.verified ? 'Verified' : 'Unverified'}
                      </span>
                      {entry.false_positive && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                          False Positive
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Status Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Calls Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage real-time admin call requests from players
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Active Status:</span>
            <button
              onClick={toggleActiveStatus}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              <span className="font-medium">
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Calls</p>
              <h3 className="text-2xl font-bold text-red-600">
                {activeCalls.length}
              </h3>
            </div>
            <Zap className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Handled Today</p>
              <h3 className="text-2xl font-bold text-blue-600">
                {calls.filter(c => 
                  c.status === 'handled' && 
                  new Date(c.handled_at || '').toDateString() === new Date().toDateString()
                ).length}
              </h3>
            </div>
            <CheckCircle className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expired Today</p>
              <h3 className="text-2xl font-bold text-yellow-600">
                {calls.filter(c => 
                  c.status === 'expired' && 
                  new Date(c.created_at).toDateString() === new Date().toDateString()
                ).length}
              </h3>
            </div>
            <Clock className="text-yellow-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Today</p>
              <h3 className="text-2xl font-bold text-primary-600">
                {calls.filter(c => 
                  new Date(c.created_at).toDateString() === new Date().toDateString()
                ).length}
              </h3>
            </div>
            <Phone className="text-primary-500" size={24} />
          </div>
        </div>
      </div>

      {/* Active Calls Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium flex items-center gap-2">
            <Zap className="text-red-500" size={20} />
            Active Calls ({activeCalls.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : activeCalls.length === 0 ? (
          <div className="text-center py-8">
            <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Active Calls
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              All clear! No players are currently requesting admin assistance.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {activeCalls.map((call) => {
              const timeRemaining = getTimeRemaining(call.expires_at);
              const isExpiring = timeRemaining !== 'EXPIRED' && timeRemaining.startsWith('0:');

              return (
                <div
                  key={call.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isExpiring ? 'border-l-4 border-red-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                          <Phone className="text-white" size={16} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            Call from {call.discord_username}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Join: {call.caller_roblox_username}</span>
                            <span>•</span>
                            <span>Suspect: {call.suspect_roblox_username}</span>
                            <span>•</span>
                            <span className={`font-mono ${isExpiring ? 'text-red-600 font-bold' : ''}`}>
                              {timeRemaining}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-13">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 rounded text-sm">
                            {reasonLabels[call.reason_category as keyof typeof reasonLabels]}
                          </span>
                          {call.suspect_avatar_url && (
                            <img
                              src={call.suspect_avatar_url}
                              alt="Suspect avatar"
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {call.reason_description}
                        </p>
                        
                        {call.proof_image_url && (
                          <div className="mb-3">
                            <img
                              src={call.proof_image_url}
                              alt="Proof"
                              className="max-w-xs h-24 object-cover rounded border cursor-pointer"
                              onClick={() => window.open(call.proof_image_url, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedCall(call);
                          setShowCallModal(true);
                        }}
                        className="btn btn-primary text-sm"
                      >
                        <Eye size={16} />
                        View Details
                      </button>
                      <button
                        onClick={() => handleCall(call.id, 'handled')}
                        className="btn btn-outline text-sm bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      >
                        <CheckCircle size={16} />
                        Handle
                      </button>
                      <button
                        onClick={() => handleCall(call.id, 'ignored')}
                        className="btn btn-outline text-sm bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      >
                        <XCircle size={16} />
                        Ignore
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Calls Section */}
      {recentCalls.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium flex items-center gap-2">
              <History className="text-gray-500" size={20} />
              Recent Calls ({recentCalls.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentCalls.map((call) => {
              const StatusIcon = statusConfig[call.status as keyof typeof statusConfig]?.icon || Clock;
              
              return (
                <div key={call.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon size={16} className="text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">
                          {call.discord_username} → {call.suspect_roblox_username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(call.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${statusConfig[call.status as keyof typeof statusConfig]?.color}`}>
                      {statusConfig[call.status as keyof typeof statusConfig]?.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-700 dark:text-green-300 px-4 py-3 rounded">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            {success}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCallModal && selectedCall && (
        <CallDetailModal call={selectedCall} />
      )}

      {showSuspicionLog && (
        <SuspicionLogModal />
      )}
    </div>
  );
};

export default AdminCallsDashboard; 