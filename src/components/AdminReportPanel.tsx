import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Filter,
  Search,
  Calendar,
  Flag,
  Users,
  Play,
  Image,
  MessageSquare,
  User,
  Tag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ReportCase {
  id: string;
  submitted_by: string;
  discord_username: string;
  reason: string;
  youtube_video_url: string;
  match_history_image_url?: string;
  reported_players: Array<{
    user_id: number;
    username: string;
    is_primary_suspect: boolean;
    roblox_avatar_url?: string;
  }>;
  primary_suspect_user_id?: number;
  video_timestamps: Array<{
    timestamp: string;
    description: string;
    url: string;
  }>;
  status: string;
  case_flags: string[];
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
  submitter?: {
    username: string;
    discord_verified_at?: string;
  };
}

interface FilterState {
  status: string;
  reason: string;
  dateRange: string;
  search: string;
  sortBy: 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}

const AdminReportPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ReportCase | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    reason: 'all',
    dateRange: 'all',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const statusConfig = {
    not_reviewed: { 
      label: 'Not Reviewed', 
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      icon: Clock 
    },
    under_review: { 
      label: 'Under Review', 
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      icon: Eye 
    },
    needs_more_evidence: { 
      label: 'Needs More Evidence', 
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: AlertTriangle 
    },
    need_another_ac_mod: { 
      label: 'Need Another AC Mod', 
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      icon: Users 
    },
    solved_banned: { 
      label: 'Solved - Banned', 
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      icon: XCircle 
    },
    solved_not_banned: { 
      label: 'Solved - Not Banned', 
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      icon: CheckCircle 
    },
    not_enough_evidence: { 
      label: 'Not Enough Evidence', 
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      icon: AlertTriangle 
    },
    invalid_report: { 
      label: 'Invalid Report', 
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      icon: XCircle 
    }
  };

  const reasonLabels = {
    'hacking/exploiting': 'Hacking/Exploiting',
    'queue_dodging': 'Queue Dodging',
    'glitch_abusing': 'Glitch Abusing',
    'alt_farming': 'Alt Farming',
    'hate_speech': 'Hate Speech',
    'hate_building': 'Hate Building'
  };

  useEffect(() => {
    fetchCases();
  }, [filters]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('admin_report_cases')
        .select(`
          *,
          submitter:submitted_by(username, discord_verified_at)
        `);

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.reason !== 'all') {
        query = query.eq('reason', filters.reason);
      }

      if (filters.search) {
        query = query.or(`discord_username.ilike.%${filters.search}%,review_notes.ilike.%${filters.search}%`);
      }

      // Apply date filtering
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });

      const { data, error } = await query;
      
      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError('Failed to fetch report cases');
    } finally {
      setLoading(false);
    }
  };

  const updateCaseStatus = async (caseId: string, newStatus: string, notes?: string, flags?: string[]) => {
    try {
      const { error } = await supabase
        .from('admin_report_cases')
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          case_flags: flags,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) throw error;

      setSuccess('Case updated successfully');
      fetchCases(); // Refresh the list
      setShowCaseModal(false);
    } catch (err) {
      console.error('Error updating case:', err);
      setError('Failed to update case');
    }
  };

  const getYouTubeVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match?.[1] || null;
  };

  const formatTimestamp = (timestamp: string) => {
    // Convert timestamp like "1:23" to seconds for YouTube API
    const parts = timestamp.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  };

  const CaseModal: React.FC<{ case: ReportCase }> = ({ case: reportCase }) => {
    const [newStatus, setNewStatus] = useState(reportCase.status);
    const [reviewNotes, setReviewNotes] = useState(reportCase.review_notes || '');
    const [selectedFlags, setSelectedFlags] = useState<string[]>(reportCase.case_flags || []);

    const availableFlags = [
      'needs_replay',
      'suspected_alt', 
      'low_evidence',
      'further_review',
      'high_priority',
      'repeat_offender',
      'multiple_reports'
    ];

    const videoId = getYouTubeVideoId(reportCase.youtube_video_url);
    const primarySuspect = reportCase.reported_players.find(p => p.is_primary_suspect);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Report Case Details</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Submitted by {reportCase.discord_username} on {new Date(reportCase.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowCaseModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XCircle size={24} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Case Status and Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="panel">
                <h3 className="panel-title">Case Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag size={16} />
                    <span className="font-medium">Reason:</span>
                    <span className="px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 rounded text-sm">
                      {reasonLabels[reportCase.reason as keyof typeof reasonLabels]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag size={16} />
                    <span className="font-medium">Status:</span>
                    <span className={`px-2 py-1 rounded text-sm ${statusConfig[reportCase.status as keyof typeof statusConfig]?.color}`}>
                      {statusConfig[reportCase.status as keyof typeof statusConfig]?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span className="font-medium">Submitted by:</span>
                    <span>{reportCase.discord_username}</span>
                    {reportCase.submitter?.discord_verified_at && (
                      <Shield size={14} className="text-green-500" title="Discord Verified" />
                    )}
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3 className="panel-title">Reported Players</h3>
                <div className="space-y-2">
                  {reportCase.reported_players.map((player, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {player.roblox_avatar_url && (
                        <img 
                          src={player.roblox_avatar_url} 
                          alt={player.username}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className={player.is_primary_suspect ? 'font-bold text-red-600 dark:text-red-400' : ''}>
                        {player.username}
                      </span>
                      {player.is_primary_suspect && (
                        <AlertTriangle size={14} className="text-red-500" title="Primary Suspect" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <h3 className="panel-title">Case Flags</h3>
                <div className="flex flex-wrap gap-1">
                  {reportCase.case_flags.map((flag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      {flag.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Evidence */}
            {videoId && (
              <div className="panel">
                <h3 className="panel-title flex items-center gap-2">
                  <Play size={18} />
                  Video Evidence
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <iframe
                      width="100%"
                      height="250"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title="Evidence Video"
                      frameBorder="0"
                      allowFullScreen
                      className="rounded"
                    />
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Timeline Tags</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {reportCase.video_timestamps.map((timestamp, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-600 rounded p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              {timestamp.timestamp}
                            </span>
                            <a
                              href={timestamp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-500 hover:text-primary-600 flex items-center gap-1"
                            >
                              <ExternalLink size={14} />
                              Jump to
                            </a>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {timestamp.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Match History Image */}
            {reportCase.match_history_image_url && (
              <div className="panel">
                <h3 className="panel-title flex items-center gap-2">
                  <Image size={18} />
                  Match History Evidence
                </h3>
                <img 
                  src={reportCase.match_history_image_url} 
                  alt="Match History"
                  className="max-w-full h-auto rounded border"
                />
              </div>
            )}

            {/* Review Section */}
            <div className="panel">
              <h3 className="panel-title">Case Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Update Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Case Flags</label>
                  <div className="flex flex-wrap gap-2">
                    {availableFlags.map(flag => (
                      <label key={flag} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedFlags.includes(flag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFlags([...selectedFlags, flag]);
                            } else {
                              setSelectedFlags(selectedFlags.filter(f => f !== flag));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{flag.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Review Notes</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={4}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    placeholder="Add notes about your review decision..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateCaseStatus(reportCase.id, newStatus, reviewNotes, selectedFlags)}
                    className="btn btn-primary"
                  >
                    Update Case
                  </button>
                  <button
                    onClick={() => setShowCaseModal(false)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Previous Review History */}
              {reportCase.review_notes && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <h4 className="font-medium text-sm mb-1">Previous Review Notes:</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {reportCase.review_notes}
                  </p>
                  {reportCase.reviewed_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Reviewed on {new Date(reportCase.reviewed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isAdmin && (!user || (user as any).trust_level < 2)) {
    return (
      <div className="text-center py-8">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          You need admin or AC moderator privileges to access the report panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Report Panel</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and review user-submitted reports for anti-cheat violations
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <AlertTriangle size={16} />
          <span>If reports aren't being responded to, please don't ping anyone - we'll handle them when we have time</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Not Reviewed</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {cases.filter(c => c.status === 'not_reviewed').length}
              </h3>
            </div>
            <Clock className="text-gray-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Under Review</p>
              <h3 className="text-2xl font-bold text-blue-600">
                {cases.filter(c => c.status === 'under_review').length}
              </h3>
            </div>
            <Eye className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Solved - Banned</p>
              <h3 className="text-2xl font-bold text-red-600">
                {cases.filter(c => c.status === 'solved_banned').length}
              </h3>
            </div>
            <XCircle className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Cases</p>
              <h3 className="text-2xl font-bold text-primary-600">
                {cases.length}
              </h3>
            </div>
            <Flag className="text-primary-500" size={24} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} />
          <h3 className="font-medium">Filters & Search</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <select
              value={filters.reason}
              onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="all">All Reasons</option>
              {Object.entries(reasonLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as 'created_at' | 'updated_at' })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="created_at">Date Submitted</option>
              <option value="updated_at">Last Updated</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Order</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Username or notes..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cases List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium">Case List ({cases.length} total)</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-8">
            <Flag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No cases found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No report cases match your current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Case Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reported Player(s)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {cases.map((reportCase) => {
                  const StatusIcon = statusConfig[reportCase.status as keyof typeof statusConfig]?.icon || Clock;
                  const primarySuspect = reportCase.reported_players.find(p => p.is_primary_suspect);
                  
                  return (
                    <tr key={reportCase.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Case #{reportCase.id.slice(-6)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <User size={12} />
                              {reportCase.discord_username}
                              {reportCase.submitter?.discord_verified_at && (
                                <Shield size={12} className="text-green-500" />
                              )}
                            </div>
                            {reportCase.case_flags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {reportCase.case_flags.slice(0, 2).map((flag, idx) => (
                                  <span key={idx} className="px-1 py-0.5 bg-gray-100 dark:bg-gray-600 rounded text-xs">
                                    {flag.replace('_', ' ')}
                                  </span>
                                ))}
                                {reportCase.case_flags.length > 2 && (
                                  <span className="text-xs text-gray-500">+{reportCase.case_flags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {primarySuspect && (
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={14} className="text-red-500" />
                              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                {primarySuspect.username}
                              </span>
                            </div>
                          )}
                          {reportCase.reported_players.filter(p => !p.is_primary_suspect).slice(0, 2).map((player, idx) => (
                            <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                              {player.username}
                            </div>
                          ))}
                          {reportCase.reported_players.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{reportCase.reported_players.length - 3} more
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 rounded text-sm">
                          {reasonLabels[reportCase.reason as keyof typeof reasonLabels]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <StatusIcon size={16} />
                          <span className={`px-2 py-1 rounded text-sm ${statusConfig[reportCase.status as keyof typeof statusConfig]?.color}`}>
                            {statusConfig[reportCase.status as keyof typeof statusConfig]?.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(reportCase.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(reportCase.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => {
                            setSelectedCase(reportCase);
                            setShowCaseModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 font-medium text-sm"
                        >
                          Review Case
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {/* Case Detail Modal */}
      {showCaseModal && selectedCase && (
        <CaseModal case={selectedCase} />
      )}
    </div>
  );
};

export default AdminReportPanel; 