import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TrustLevel, TRUST_LEVEL_CONFIGS } from "../../types/trustLevels";
import { FaDiscord, FaCheck, FaTimes } from "react-icons/fa";
import { Shield, Clock, Coins, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { TimeTrackingService } from "../../services/timeTrackingService";

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  trust_level: number;
  discord_verified: boolean;
  discord_username: string | null;
  discord_id: string | null;
  discord_verified_at: string | null;
}

interface Props {
  userId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

const UserPrivilegeEditor: React.FC<Props> = ({ userId, onClose, onUpdated }) => {
  const { user } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ username: string } | null>(null);
  const [userRestrictions, setUserRestrictions] = useState<any[]>([]);
  const [userReportStats, setUserReportStats] = useState<any>(null);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionForm, setRestrictionForm] = useState({
    restrictionType: 'temp_ban' as 'warning' | 'temp_ban' | 'permanent_ban',
    reason: '',
    duration: 24
  });
  const [userTimeStats, setUserTimeStats] = useState<{
    total_time_seconds: number;
    total_coins: number;
    coins_from_time: number;
    last_activity: string;
    active_sessions: number;
  } | null>(null);
  const [loadingTimeStats, setLoadingTimeStats] = useState(false);
  
  // Check if current user is therac (only admin who can see Discord data)
  const canViewDiscordData = currentUserProfile?.username === "therac";

  // Fetch current user's profile to get username
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("users")
        .select("username")
        .eq("id", user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setCurrentUserProfile(data);
          }
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    
    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select(`
            *,
            discord_verifications(
              discord_id,
              discord_username,
              is_verified,
              created_at
            )
          `)
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Error fetching user:", error);
          setLoading(false);
          return;
        }
        
        // Transform the data to match our User interface
        const transformedUser = {
          id: data.id,
          username: data.username,
          email: data.email,
          is_admin: data.is_admin,
          trust_level: data.trust_level,
          discord_verified: data.discord_verifications?.is_verified || false,
          discord_username: data.discord_verifications?.discord_username || null,
          discord_id: data.discord_verifications?.discord_id || null,
          discord_verified_at: data.discord_verifications?.created_at || null,
        };
        
        setUserData(transformedUser);
        setTrustLevel(transformedUser.trust_level);
        setIsAdmin(transformedUser.is_admin);
        
        // Fetch user's report restrictions and stats
        const [restrictionsResult, statsResult] = await Promise.all([
          supabase
            .from('user_report_restrictions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('user_report_stats')
            .select('*')
            .eq('user_id', userId)
            .single()
        ]);
        
        setUserRestrictions(restrictionsResult.data || []);
        setUserReportStats(statsResult.data);
        
        // Fetch user time and coin stats
        await loadUserTimeStats();
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ trust_level: trustLevel, is_admin: isAdmin })
      .eq("id", userId);
    setLoading(false);
    if (!error) {
      onUpdated();
      onClose();
    } else {
      console.error('Error updating user privileges:', error);
      alert('Failed to update user privileges. Please try again.');
    }
  };

  const formatDiscordDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const loadUserTimeStats = async () => {
    if (!userId) return;
    
    setLoadingTimeStats(true);
    try {
      const stats = await TimeTrackingService.getUserTimeStats(userId);
      setUserTimeStats(stats);
    } catch (error) {
      console.error('Error loading user time stats:', error);
    } finally {
      setLoadingTimeStats(false);
    }
  };

  const forceUpdateUserCoins = async () => {
    if (!userId) return;
    
    try {
      await TimeTrackingService.forceUpdateUserCoins(userId);
      await loadUserTimeStats();
      alert('User coins updated successfully!');
    } catch (error) {
      console.error('Error updating user coins:', error);
      alert('Failed to update user coins. Please try again.');
    }
  };

  const addRestriction = async () => {
    if (!restrictionForm.reason || !userId) return;

    try {
      const expiresAt = restrictionForm.restrictionType === 'permanent_ban' 
        ? null 
        : new Date(Date.now() + (restrictionForm.duration * 60 * 60 * 1000)).toISOString();

      const { error } = await supabase.rpc('add_user_restriction', {
        user_uuid: userId,
        restriction_type: restrictionForm.restrictionType,
        reason: restrictionForm.reason,
        expires_at: expiresAt
      });

      if (error) throw error;

      setShowRestrictionModal(false);
      setRestrictionForm({
        restrictionType: 'temp_ban',
        reason: '',
        duration: 24
      });
      
      // Refresh restrictions
      const { data: restrictionsData } = await supabase
        .from('user_report_restrictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      setUserRestrictions(restrictionsData || []);
    } catch (error) {
      console.error('Error adding restriction:', error);
      alert('Failed to add restriction. Please try again.');
    }
  };

  const removeRestriction = async (restrictionId: string) => {
    if (!window.confirm('Remove this restriction?')) return;

    try {
      const { error } = await supabase.rpc('remove_user_restriction', {
        restriction_id: restrictionId
      });

      if (error) throw error;
      
      // Refresh restrictions
      const { data: restrictionsData } = await supabase
        .from('user_report_restrictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      setUserRestrictions(restrictionsData || []);
    } catch (error) {
      console.error('Error removing restriction:', error);
      alert('Failed to remove restriction. Please try again.');
    }
  };

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#232b36] dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-[#3a4250] max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-gray-200">Edit User Privileges</h3>
        {loading ? (
          <div className="text-gray-200">Loading...</div>
        ) : userData ? (
          <>
            <div className="mb-4">
              <div className="mb-2 text-gray-200">Username: <b className="text-white">{userData.username}</b></div>
              <div className="mb-2 text-gray-200">Email: <span className="text-white">{userData.email}</span></div>
            </div>

            {/* Discord Verification Section */}
            <div className="mb-6 p-4 bg-[#2a323c] rounded-lg border border-[#3a4250]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <FaDiscord color="#5865f2" />
                  Discord Verification Status
                </h4>
                {canViewDiscordData && (
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <FaDiscord />
                    Discord Data Access
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Status:</span>
                  <div className="flex items-center gap-2">
                    {userData.discord_verified ? (
                      <>
                        <FaDiscord color="#5865f2" />
                        <FaCheck color="#22c55e" />
                        <span className="text-green-400">Verified</span>
                      </>
                    ) : (
                      <>
                        <FaTimes color="#ef4444" />
                        <span className="text-red-400">Not Verified</span>
                      </>
                    )}
                  </div>
                </div>
                {canViewDiscordData ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Discord Username:</span>
                      <span className="text-white">{userData.discord_username || "Not linked"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Discord ID:</span>
                      <span className="text-white">{userData.discord_id || "Not linked"}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Discord Data:</span>
                    <span className="text-gray-500 italic">Restricted - Admin access only</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Linked Date:</span>
                  <span className="text-white">{formatDiscordDate(userData.discord_verified_at)}</span>
                </div>
              </div>
            </div>

            {/* Time & Coin Statistics Section */}
            <div className="mb-6 p-4 bg-[#2a323c] rounded-lg border border-[#3a4250]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Time & Coin Statistics
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={loadUserTimeStats}
                    disabled={loadingTimeStats}
                    className="btn btn-sm btn-outline"
                    title="Refresh stats"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingTimeStats ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={forceUpdateUserCoins}
                    className="btn btn-sm btn-primary"
                    title="Force update coins from time spent"
                  >
                    <Coins className="w-4 h-4" />
                    Update Coins
                  </button>
                </div>
              </div>
              
              {loadingTimeStats ? (
                <div className="text-center py-4 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading statistics...
                </div>
              ) : userTimeStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-[#323a45] rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-400 font-medium">Total Time</span>
                      </div>
                      <div className="text-white text-lg font-semibold">
                        {TimeTrackingService.formatDuration(userTimeStats.total_time_seconds)}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-[#323a45] rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-gray-400 font-medium">Total Coins</span>
                      </div>
                      <div className="text-white text-lg font-semibold">
                        {userTimeStats.total_coins.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Coins from Time:</span>
                      <span className="text-yellow-400 ml-2 font-medium">
                        {userTimeStats.coins_from_time.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Active Sessions:</span>
                      <span className={`ml-2 font-medium ${
                        userTimeStats.active_sessions > 0 ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {userTimeStats.active_sessions}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-gray-400">Last Activity:</span>
                    <span className="text-white ml-2">
                      {userTimeStats.last_activity ? new Date(userTimeStats.last_activity).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500 bg-[#1a1f26] p-2 rounded">
                    <div className="font-medium mb-1">Reward System:</div>
                    <div>• 30 coins awarded every 30 minutes of active time</div>
                    <div>• Time tracking is website-wide, not page-specific</div>
                    <div>• Activity updates every 5 minutes to minimize egress</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>No time statistics available</div>
                  <div className="text-xs mt-1">User may not have any recorded activity</div>
                </div>
              )}
            </div>

            {/* Report Restrictions Section */}
            <div className="mb-6 p-4 bg-[#2a323c] rounded-lg border border-[#3a4250]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <Shield />
                  Report Restrictions
                </h4>
                <button
                  onClick={() => setShowRestrictionModal(true)}
                  className="btn btn-sm btn-outline"
                >
                  Add Restriction
                </button>
              </div>
              
              {userReportStats && (
                <div className="mb-4 p-3 bg-[#323a45] rounded">
                  <h5 className="text-sm font-medium text-gray-200 mb-2">Report Statistics</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Total Reports:</span>
                      <span className="text-white ml-2">{userReportStats.total_reports_submitted || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">False Reports:</span>
                      <span className="text-white ml-2">{userReportStats.false_reports_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">False Rate:</span>
                      <span className={`ml-2 ${
                        (userReportStats.false_report_rate || 0) > 0.5 ? 'text-red-400' :
                        (userReportStats.false_report_rate || 0) > 0.2 ? 'text-orange-400' :
                        'text-green-400'
                      }`}>
                        {((userReportStats.false_report_rate || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Last Report:</span>
                      <span className="text-white ml-2">
                        {userReportStats.last_report_at ? new Date(userReportStats.last_report_at).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {userRestrictions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-200">Active Restrictions</h5>
                  {userRestrictions.filter(r => !r.expires_at || new Date(r.expires_at) > new Date()).map((restriction) => (
                    <div key={restriction.id} className="p-2 bg-red-900/20 border border-red-700 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-red-200">
                            {restriction.restriction_type === 'warning' ? 'Warning' :
                             restriction.restriction_type === 'temp_ban' ? 'Temporary Ban' :
                             'Permanent Ban'}
                          </div>
                          <div className="text-xs text-red-300">{restriction.reason}</div>
                          {restriction.expires_at && (
                            <div className="text-xs text-red-400">
                              Expires: {new Date(restriction.expires_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                                                 <button
                           onClick={() => removeRestriction(restriction.id)}
                           className="btn btn-xs btn-error"
                         >
                           Remove
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-gray-200">
                <input 
                  type="checkbox" 
                  checked={isAdmin} 
                  onChange={e => setIsAdmin(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                <span>Admin</span>
              </label>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-200">Trust Level:</label>
              <select 
                className="w-full p-2 border rounded bg-[#323a45] text-gray-200 border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={trustLevel} 
                onChange={e => setTrustLevel(Number(e.target.value) as TrustLevel)}
              >
                {TRUST_LEVEL_CONFIGS.map(config => (
                  <option key={config.level} value={config.level}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
              <button className="btn btn-ghost text-gray-200" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="text-gray-200">User not found.</div>
        )}
      </div>

      {/* Add Restriction Modal */}
      {showRestrictionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232b36] dark:bg-gray-800 rounded-lg max-w-md w-full border border-[#3a4250]">
            <div className="p-6 border-b border-[#3a4250]">
              <h3 className="text-lg font-bold text-gray-200">Add Report Restriction</h3>
              <p className="text-sm text-gray-400 mt-1">
                Restrict {userData?.username || 'this user'} from submitting reports
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Restriction Type</label>
                <select
                  value={restrictionForm.restrictionType}
                  onChange={(e) => setRestrictionForm({
                    ...restrictionForm,
                    restrictionType: e.target.value as 'warning' | 'temp_ban' | 'permanent_ban'
                  })}
                  className="w-full p-2 border border-[#3a4250] rounded bg-[#323a45] text-gray-200"
                >
                  <option value="warning">Warning</option>
                  <option value="temp_ban">Temporary Ban</option>
                  <option value="permanent_ban">Permanent Ban</option>
                </select>
              </div>

              {restrictionForm.restrictionType === 'temp_ban' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-200">Duration (hours)</label>
                  <input
                    type="number"
                    value={restrictionForm.duration}
                    onChange={(e) => setRestrictionForm({
                      ...restrictionForm,
                      duration: parseInt(e.target.value) || 24
                    })}
                    className="w-full p-2 border border-[#3a4250] rounded bg-[#323a45] text-gray-200"
                    min="1"
                    max="8760" // 1 year
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Reason</label>
                <textarea
                  value={restrictionForm.reason}
                  onChange={(e) => setRestrictionForm({
                    ...restrictionForm,
                    reason: e.target.value
                  })}
                  rows={3}
                  className="w-full p-2 border border-[#3a4250] rounded bg-[#323a45] text-gray-200"
                  placeholder="Reason for restriction..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addRestriction}
                  className="btn btn-primary"
                  disabled={!restrictionForm.reason}
                >
                  Add Restriction
                </button>
                <button
                  onClick={() => setShowRestrictionModal(false)}
                  className="btn btn-ghost text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPrivilegeEditor; 