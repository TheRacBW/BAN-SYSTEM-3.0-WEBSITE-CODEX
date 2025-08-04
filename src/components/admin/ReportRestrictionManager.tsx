import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Shield,
  Ban,
  Unlock,
  Calendar,
  MessageSquare,
  Users,
  Flag
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ReportRestriction {
  id: string;
  user_id: string;
  restriction_type: 'warning' | 'temp_ban' | 'permanent_ban';
  reason: string;
  expires_at: string | null;
  created_at: string;
  created_by: string;
  user?: {
    username: string;
    email: string;
    discord_username?: string;
  };
  creator?: {
    username: string;
  };
}

interface UserReportStats {
  user_id: string;
  total_reports_submitted: number;
  false_reports_count: number;
  false_report_rate: number;
  last_report_at: string | null;
  user?: {
    username: string;
    email: string;
    discord_username?: string;
  };
}

const ReportRestrictionManager: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [restrictions, setRestrictions] = useState<ReportRestriction[]>([]);
  const [userStats, setUserStats] = useState<UserReportStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionForm, setRestrictionForm] = useState({
    restrictionType: 'temp_ban' as 'warning' | 'temp_ban' | 'permanent_ban',
    reason: '',
    duration: 24, // hours
    customDuration: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch current restrictions
      const { data: restrictionsData } = await supabase
        .from('user_report_restrictions')
        .select(`
          *,
          user:user_id(username, email, discord_username),
          creator:created_by(username)
        `)
        .order('created_at', { ascending: false });

      // Fetch user report statistics
      const { data: statsData } = await supabase
        .from('user_report_stats')
        .select(`
          *,
          user:user_id(username, email, discord_username)
        `)
        .order('false_report_rate', { ascending: false });

      setRestrictions(restrictionsData || []);
      setUserStats(statsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRestriction = async () => {
    if (!selectedUser || !restrictionForm.reason) return;

    try {
      const expiresAt = restrictionForm.restrictionType === 'permanent_ban' 
        ? null 
        : new Date(Date.now() + (restrictionForm.duration * 60 * 60 * 1000)).toISOString();

      const { error } = await supabase.rpc('add_user_restriction', {
        user_uuid: selectedUser,
        restriction_type: restrictionForm.restrictionType,
        reason: restrictionForm.reason,
        expires_at: expiresAt
      });

      if (error) throw error;

      setShowRestrictionModal(false);
      setSelectedUser(null);
      setRestrictionForm({
        restrictionType: 'temp_ban',
        reason: '',
        duration: 24,
        customDuration: false
      });
      fetchData();
    } catch (error) {
      console.error('Error adding restriction:', error);
    }
  };

  const removeRestriction = async (restrictionId: string) => {
    if (!window.confirm('Remove this restriction?')) return;

    try {
      const { error } = await supabase.rpc('remove_user_restriction', {
        restriction_id: restrictionId
      });

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error removing restriction:', error);
    }
  };

  const getRestrictionTypeLabel = (type: string) => {
    switch (type) {
      case 'warning': return 'Warning';
      case 'temp_ban': return 'Temporary Ban';
      case 'permanent_ban': return 'Permanent Ban';
      default: return type;
    }
  };

  const getRestrictionTypeColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'temp_ban': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'permanent_ban': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          You need admin privileges to access the report restriction manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Report Restriction Manager</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage user restrictions for false reporting and abuse
          </p>
        </div>
        <button
          onClick={() => setShowRestrictionModal(true)}
          className="btn btn-primary"
        >
          <Ban size={16} />
          Add Restriction
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Restrictions</p>
              <h3 className="text-2xl font-bold text-red-600">
                {restrictions.filter(r => !isExpired(r.expires_at)).length}
              </h3>
            </div>
            <Ban className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Permanent Bans</p>
              <h3 className="text-2xl font-bold text-red-600">
                {restrictions.filter(r => r.restriction_type === 'permanent_ban').length}
              </h3>
            </div>
            <XCircle className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">High Risk Users</p>
              <h3 className="text-2xl font-bold text-orange-600">
                {userStats.filter(s => s.false_report_rate > 0.5).length}
              </h3>
            </div>
            <AlertTriangle className="text-orange-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
              <h3 className="text-2xl font-bold text-primary-600">
                {userStats.length}
              </h3>
            </div>
            <Users className="text-primary-500" size={24} />
          </div>
        </div>
      </div>

      {/* User Statistics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium">User Report Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reports
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  False Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Report
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {userStats.map((stat) => (
                <tr key={stat.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {stat.user?.username || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {stat.user?.discord_username && (
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} />
                              {stat.user.discord_username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {stat.total_reports_submitted}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {stat.false_reports_count} false
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-sm font-medium ${
                      stat.false_report_rate > 0.5 ? 'text-red-600 dark:text-red-400' :
                      stat.false_report_rate > 0.2 ? 'text-orange-600 dark:text-orange-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {(stat.false_report_rate * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {stat.last_report_at ? new Date(stat.last_report_at).toLocaleDateString() : 'Never'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => {
                        setSelectedUser(stat.user_id);
                        setShowRestrictionModal(true);
                      }}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 font-medium text-sm"
                    >
                      Restrict
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Restrictions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium">Active Restrictions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {restrictions.filter(r => !isExpired(r.expires_at)).map((restriction) => (
                <tr key={restriction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {restriction.user?.username || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {restriction.user?.discord_username && (
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {restriction.user.discord_username}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded text-sm ${getRestrictionTypeColor(restriction.restriction_type)}`}>
                      {getRestrictionTypeLabel(restriction.restriction_type)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {restriction.reason}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {restriction.expires_at ? new Date(restriction.expires_at).toLocaleString() : 'Never'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {restriction.creator?.username || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => removeRestriction(restriction.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Restriction Modal */}
      {showRestrictionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold">Add Report Restriction</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">User</label>
                <select
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="">Select a user...</option>
                  {userStats.map((stat) => (
                    <option key={stat.user_id} value={stat.user_id}>
                      {stat.user?.username || 'Unknown'} 
                      {stat.user?.discord_username && ` (${stat.user.discord_username})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Restriction Type</label>
                <select
                  value={restrictionForm.restrictionType}
                  onChange={(e) => setRestrictionForm({
                    ...restrictionForm,
                    restrictionType: e.target.value as 'warning' | 'temp_ban' | 'permanent_ban'
                  })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="warning">Warning</option>
                  <option value="temp_ban">Temporary Ban</option>
                  <option value="permanent_ban">Permanent Ban</option>
                </select>
              </div>

              {restrictionForm.restrictionType === 'temp_ban' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Duration (hours)</label>
                  <input
                    type="number"
                    value={restrictionForm.duration}
                    onChange={(e) => setRestrictionForm({
                      ...restrictionForm,
                      duration: parseInt(e.target.value) || 24
                    })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    min="1"
                    max="8760" // 1 year
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <textarea
                  value={restrictionForm.reason}
                  onChange={(e) => setRestrictionForm({
                    ...restrictionForm,
                    reason: e.target.value
                  })}
                  rows={3}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  placeholder="Reason for restriction..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addRestriction}
                  className="btn btn-primary"
                  disabled={!selectedUser || !restrictionForm.reason}
                >
                  Add Restriction
                </button>
                <button
                  onClick={() => setShowRestrictionModal(false)}
                  className="btn btn-outline"
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

export default ReportRestrictionManager; 