import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  TrendingUp, 
  Camera, 
  Activity, 
  Award, 
  ChevronDown, 
  ChevronUp,
  Download,
  Calendar,
  BarChart3,
  Clock,
  Target,
  Zap,
  Shield,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getUserMMRHistory, 
  getUserMatchStats, 
  getUserMatches,
  exportUserData,
  deleteMMRSnapshot,
  type MMRSnapshot,
  type UserMMRStats,
  type UserMatch
} from '../../services/mmrService';
import { ResponsiveContainer, LineChart, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import RankBadge from '../leaderboard/RankBadge';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = 'blue' }) => (
  <div className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-700 rounded-lg p-4`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-medium text-${color}-600 dark:text-${color}-400`}>{title}</p>
        <p className={`text-2xl font-bold text-${color}-900 dark:text-${color}-100`}>{value}</p>
      </div>
      <div className={`text-${color}-500 dark:text-${color}-400`}>{icon}</div>
    </div>
  </div>
);

interface DateRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
  >
    <option value="7d">Last 7 days</option>
    <option value="30d">Last 30 days</option>
    <option value="90d">Last 90 days</option>
    <option value="all">All time</option>
  </select>
);

interface MMRTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const MMRTooltip: React.FC<MMRTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {new Date(data.created_at).toLocaleDateString()}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          MMR: <span className="font-mono">{data.estimated_glicko}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Rank: {data.current_rank.replace('_', ' ')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          RP: {data.current_rp}
        </p>
      </div>
    );
  }
  return null;
};

interface ExpandableRowProps {
  snapshot: MMRSnapshot;
  onExpand: (snapshot: MMRSnapshot) => void;
  onDelete: (snapshotId: string) => void;
  isDeleting: boolean;
}

const ExpandableRow: React.FC<ExpandableRowProps> = ({ snapshot, onExpand, onDelete, isDeleting }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    if (!isExpanded && matches.length === 0) {
      setLoading(true);
      try {
        const snapshotMatches = await getUserMatches(snapshot.user_id, snapshot.id);
        setMatches(snapshotMatches);
      } catch (error) {
        console.error('Error loading matches:', error);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
    onExpand(snapshot);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAccuracyColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <>
      <tr 
        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        onClick={handleExpand}
      >
        <td className="px-4 py-3 text-sm">{formatDate(snapshot.created_at)}</td>
        <td className="px-4 py-3">
          <RankBadge rankTitle={snapshot.current_rank.replace('_', ' ')} rp={snapshot.current_rp} size="small" />
        </td>
        <td className="px-4 py-3 text-sm font-mono">{snapshot.current_rp}</td>
        <td className="px-4 py-3 text-sm font-mono">{Math.round(snapshot.estimated_glicko)}</td>
        <td className="px-4 py-3">
          <span className={`text-sm font-medium ${getAccuracyColor(snapshot.accuracy_score)}`}>
            {snapshot.accuracy_score}%
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {snapshot.user_notes ? (
            <span className="truncate block max-w-xs" title={snapshot.user_notes}>
              {snapshot.user_notes}
            </span>
          ) : (
            <span className="text-gray-400 italic">No notes</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(snapshot.id);
              }}
              disabled={isDeleting}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
              title="Delete snapshot"
            >
              {isDeleting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">MMR Details</h4>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div>Rating: {Math.round(snapshot.estimated_glicko)}</div>
                  <div>RD: {snapshot.estimated_rd.toFixed(2)}</div>
                  <div>Volatility: {snapshot.estimated_volatility.toFixed(3)}</div>
                  {snapshot.skill_gap && <div>Skill Gap: {Math.round(snapshot.skill_gap)}</div>}
                  {snapshot.ranking_status && <div>Status: {snapshot.ranking_status}</div>}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Recent Matches</h4>
                {loading ? (
                  <div className="text-sm text-gray-500">Loading matches...</div>
                ) : matches.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {matches.map((match, index) => (
                      <div key={`${match.user_id}-${match.match_number}-${match.recorded_in_snapshot}`} className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${
                          match.outcome === 'win' ? 'text-green-600' : 
                          match.outcome === 'loss' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {match.outcome.toUpperCase()}
                        </span>
                        <span className="font-mono">
                          {match.rp_change > 0 ? '+' : ''}{match.rp_change} RP
                        </span>
                        {match.was_shielded && <Shield className="w-3 h-3 text-blue-500" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No matches recorded</div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

interface ContributionLevelBadgeProps {
  level: number;
}

const ContributionLevelBadge: React.FC<ContributionLevelBadgeProps> = ({ level }) => {
  const levels = {
    0: { name: 'New User', color: 'gray', benefits: [] },
    1: { name: 'Contributor', color: 'blue', benefits: ['Improved Predictions'] },
    2: { name: 'Data Partner', color: 'purple', benefits: ['Premium Insights', 'Priority Support'] },
    3: { name: 'Research Ally', color: 'gold', benefits: ['Advanced Analytics', 'Beta Features'] }
  };
  
  const currentLevel = levels[level as keyof typeof levels] || levels[0];
  
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm bg-${currentLevel.color}-100 text-${currentLevel.color}-800 dark:bg-${currentLevel.color}-900/20 dark:text-${currentLevel.color}-300`}>
      <Award className="w-4 h-4 mr-1" />
      {currentLevel.name}
    </div>
  );
};

const MMRHistoryTab: React.FC = () => {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<MMRSnapshot[]>([]);
  const [userStats, setUserStats] = useState<UserMMRStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<MMRSnapshot | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [noteFilter, setNoteFilter] = useState<string>('');
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [deletingSnapshot, setDeletingSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async (forceRefresh = false) => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('📥 Loading user data for user:', user.id, forceRefresh ? '(force refresh)' : '');
      
      // Add a small delay to ensure database changes are propagated
      if (forceRefresh) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const [historyData, statsData] = await Promise.all([
        getUserMMRHistory(user.id, 50),
        getUserMatchStats(user.id)
      ]);
      
      console.log('📊 Loaded snapshots:', historyData.length);
      console.log('📈 Loaded stats:', statsData);
      
      setSnapshots(historyData);
      setUserStats(statsData);
    } catch (error) {
      console.error('❌ Error loading MMR history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (format: 'csv' | 'json' = 'json') => {
    if (!user) return;
    
    setExporting(true);
    try {
      const data = await exportUserData(user.id, format);
      
      // Create and download file
      const blob = new Blob([data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mmr-history-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!user || !confirm('Are you sure you want to delete this snapshot? This action cannot be undone.')) {
      return;
    }
    
    setDeletingSnapshot(snapshotId);
    try {
      console.log('🗑️ Deleting snapshot:', snapshotId);
      await deleteMMRSnapshot(snapshotId);
      console.log('✅ Snapshot deleted successfully');
      
      // Immediately remove from local state
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
      
      // Refresh the data with force refresh
      console.log('🔄 Refreshing data with force refresh...');
      await loadUserData(true);
      console.log('✅ Data refreshed');
    } catch (error) {
      console.error('❌ Error deleting snapshot:', error);
      alert('Failed to delete snapshot. Please try again.');
    } finally {
      setDeletingSnapshot(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const filterSnapshotsByDateRange = (snapshots: MMRSnapshot[], range: string) => {
    if (range === 'all') return snapshots;
    
    const now = new Date();
    const days = parseInt(range.replace('d', ''));
    const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    return snapshots.filter(snapshot => new Date(snapshot.created_at) >= cutoffDate);
  };

  // Extract unique usernames from notes
  const getUniqueUsernames = (snapshots: MMRSnapshot[]) => {
    const usernames = new Set<string>();
    snapshots.forEach(snapshot => {
      if (snapshot.user_notes && snapshot.user_notes.trim()) {
        usernames.add(snapshot.user_notes.trim());
      }
    });
    return Array.from(usernames).sort();
  };

  // Filter snapshots by notes/username
  const filterSnapshotsByNotes = (snapshots: MMRSnapshot[], filter: string) => {
    if (!filter.trim()) return snapshots;
    return snapshots.filter(snapshot => 
      snapshot.user_notes && 
      snapshot.user_notes.toLowerCase().includes(filter.toLowerCase())
    );
  };

  // Group snapshots by username for colored lines
  const groupSnapshotsByUsername = (snapshots: MMRSnapshot[]) => {
    const groups: { [username: string]: MMRSnapshot[] } = {};
    
    snapshots.forEach(snapshot => {
      const username = snapshot.user_notes?.trim() || 'Unknown';
      if (!groups[username]) {
        groups[username] = [];
      }
      groups[username].push(snapshot);
    });
    
    return groups;
  };

  // Apply all filters
  const filteredSnapshots = filterSnapshotsByNotes(
    filterSnapshotsByDateRange(snapshots, dateRange), 
    noteFilter
  );

  const groupedSnapshots = groupSnapshotsByUsername(filteredSnapshots);
  const uniqueUsernames = getUniqueUsernames(snapshots);

  // Authentication Check
  if (!user) {
    return (
      <div className="text-center py-12">
        <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Authentication Required</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Sign in to view your MMR history and track progress</p>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading your MMR history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Peak MMR" 
          value={userStats?.peak_glicko ? Math.round(userStats.peak_glicko) : 'N/A'} 
          icon={<TrendingUp className="w-5 h-5" />} 
          color="green"
        />
        <StatCard 
          title="Total Snapshots" 
          value={userStats?.total_snapshots || 0} 
          icon={<Camera className="w-5 h-5" />} 
          color="blue"
        />
        <StatCard 
          title="30d Change" 
          value={userStats?.glicko_change_30d ? `${userStats.glicko_change_30d > 0 ? '+' : ''}${Math.round(userStats.glicko_change_30d)}` : 'N/A'} 
          icon={<Activity className="w-5 h-5" />} 
          color="purple"
        />
        <StatCard 
          title="Contribution Level" 
          value={userStats?.data_contribution_level || 0} 
          icon={<Award className="w-5 h-5" />} 
          color="yellow"
        />
      </div>

      {/* Contribution Level Badge */}
      {userStats && userStats.data_contribution_level > 0 && (
        <div className="flex items-center justify-center mb-6">
          <ContributionLevelBadge level={userStats.data_contribution_level} />
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => handleExportData('json')}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
        >
          {exporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Data
            </>
          )}
        </button>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Username/Notes
            </label>
            <input
              type="text"
              value={noteFilter}
              onChange={(e) => setNoteFilter(e.target.value)}
              placeholder="Type username to filter..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quick Username Filters
            </label>
            <div className="flex flex-wrap gap-2">
              {uniqueUsernames.slice(0, 5).map(username => (
                <button
                  key={username}
                  onClick={() => setNoteFilter(noteFilter === username ? '' : username)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    noteFilter === username
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  {username}
                </button>
              ))}
              {uniqueUsernames.length > 5 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                  +{uniqueUsernames.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MMR Timeline Chart */}
      {filteredSnapshots.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              MMR Progression
            </h3>
            <DateRangeSelector value={dateRange} onChange={setDateRange} />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={filteredSnapshots}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="created_at" 
                tickFormatter={formatDate}
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                dataKey="estimated_glicko" 
                stroke="#6B7280"
                fontSize={12}
              />
              <Tooltip content={<MMRTooltip />} />
              {Object.entries(groupedSnapshots).map(([username, userSnapshots], index) => {
                const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
                const color = colors[index % colors.length];
                
                return (
                  <Line 
                    key={username}
                    type="monotone" 
                    dataKey="estimated_glicko" 
                    data={userSnapshots}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: color }}
                    name={username}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
          
          {/* Username Legend */}
          {Object.keys(groupedSnapshots).length > 1 && (
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {Object.entries(groupedSnapshots).map(([username, userSnapshots], index) => {
                const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
                const color = colors[index % colors.length];
                
                return (
                  <div key={username} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {username} ({userSnapshots.length} snapshots)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Snapshots Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            MMR Snapshots
          </h3>
        </div>
        {snapshots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">RP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MMR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Accuracy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {snapshots.map(snapshot => (
                  <ExpandableRow 
                    key={snapshot.id} 
                    snapshot={snapshot}
                    onExpand={setSelectedSnapshot}
                    onDelete={handleDeleteSnapshot}
                    isDeleting={deletingSnapshot === snapshot.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Snapshots Yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Save your first MMR snapshot to start tracking your progress!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MMRHistoryTab; 