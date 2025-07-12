import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  Clock, 
  Play, 
  Pause, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Calendar,
  Database,
  TrendingDown,
  HardDrive,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { runEgressOptimizer } from '../../services/leaderboardService';

interface CleanupResult {
  table_name: string;
  phase: string;
  recent_before: number;
  recent_after: number;
  old_before: number;
  old_after: number;
  total_removed: number;
  space_saved_mb: number;
}

interface CleanupPhaseStats {
  phase: string;
  totalRemoved: number;
  spaceSaved: number;
  tablesAffected: string[];
}

interface CleanupSummary {
  totalRecordsRemoved: number;
  totalSpaceSaved: number;
  phases: CleanupPhaseStats[];
  tablesAffected: string[];
  mostEffectivePhase: string;
  mostAffectedTable: string;
}

interface CleanupHistory {
  id: string;
  timestamp: string;
  results: CleanupResult[];
  totalRecordsRemoved: number;
  totalSpaceSaved: number;
  status: 'success' | 'error';
  error?: string;
}

interface SchedulerSettings {
  enabled: boolean;
  frequency: 'manual' | 'daily' | 'every_2_days' | 'every_3_days' | 'weekly';
  nextRun?: string;
}

const EgressOptimizer: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [schedulerSettings, setSchedulerSettings] = useState<SchedulerSettings>({
    enabled: false,
    frequency: 'manual'
  });
  const [cleanupHistory, setCleanupHistory] = useState<CleanupHistory[]>([]);
  const [lastResult, setLastResult] = useState<CleanupResult[] | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<CleanupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const schedulerRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings and history from localStorage on mount
  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  // Set up scheduler when settings change
  useEffect(() => {
    setupScheduler();
    return () => {
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
      }
    };
  }, [schedulerSettings]);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('egress_optimizer_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setSchedulerSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = (settings: SchedulerSettings) => {
    try {
      localStorage.setItem('egress_optimizer_settings', JSON.stringify(settings));
      setSchedulerSettings(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('egress_optimizer_history');
      if (saved) {
        setCleanupHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const saveHistory = (history: CleanupHistory[]) => {
    try {
      // Keep only last 50 entries to prevent localStorage from getting too large
      const trimmedHistory = history.slice(-50);
      localStorage.setItem('egress_optimizer_history', JSON.stringify(trimmedHistory));
      setCleanupHistory(trimmedHistory);
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const setupScheduler = () => {
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
    }

    if (!schedulerSettings.enabled || schedulerSettings.frequency === 'manual') {
      return;
    }

    const getIntervalMs = () => {
      switch (schedulerSettings.frequency) {
        case 'daily': return 24 * 60 * 60 * 1000;
        case 'every_2_days': return 2 * 24 * 60 * 60 * 1000;
        case 'every_3_days': return 3 * 24 * 60 * 60 * 1000;
        case 'weekly': return 7 * 24 * 60 * 60 * 1000;
        default: return 24 * 60 * 60 * 1000;
      }
    };

    const intervalMs = getIntervalMs();
    schedulerRef.current = setInterval(() => {
      runCleanup();
    }, intervalMs);

    // Set next run time
    const nextRun = new Date(Date.now() + intervalMs);
    saveSettings({
      ...schedulerSettings,
      nextRun: nextRun.toISOString()
    });
  };

  const runCleanup = async () => {
    setIsRunning(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await runEgressOptimizer();
      
      if (data && Array.isArray(data)) {
        const results = data as CleanupResult[];
        const analysis = analyzeCleanupResults(results);

        const historyEntry: CleanupHistory = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          results,
          totalRecordsRemoved: analysis.totalRecordsRemoved,
          totalSpaceSaved: analysis.totalSpaceSaved,
          status: 'success'
        };

        const newHistory = [historyEntry, ...cleanupHistory];
        saveHistory(newHistory);
        setLastResult(results);
        setLastAnalysis(analysis);
        setSuccess(`✅ Cleanup completed! Removed ${analysis.totalRecordsRemoved.toLocaleString()} records and saved ${analysis.totalSpaceSaved.toFixed(2)} MB.`);
      } else {
        throw new Error('No data returned from cleanup function');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`❌ Cleanup failed: ${errorMessage}`);
      
      const historyEntry: CleanupHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        results: [],
        totalRecordsRemoved: 0,
        totalSpaceSaved: 0,
        status: 'error',
        error: errorMessage
      };

      const newHistory = [historyEntry, ...cleanupHistory];
      saveHistory(newHistory);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSchedulerToggle = (enabled: boolean) => {
    const newSettings = { ...schedulerSettings, enabled };
    saveSettings(newSettings);
  };

  const handleFrequencyChange = (frequency: SchedulerSettings['frequency']) => {
    const newSettings = { ...schedulerSettings, frequency };
    saveSettings(newSettings);
  };

  const getNextRunDisplay = () => {
    if (!schedulerSettings.enabled || !schedulerSettings.nextRun) {
      return 'Not scheduled';
    }
    
    const nextRun = new Date(schedulerSettings.nextRun);
    const now = new Date();
    const diffMs = nextRun.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Due now';
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} remaining`;
    } else {
      return 'Less than 1 hour remaining';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const analyzeCleanupResults = (results: CleanupResult[]): CleanupSummary => {
    const summary: CleanupSummary = {
      totalRecordsRemoved: 0,
      totalSpaceSaved: 0,
      phases: [],
      tablesAffected: [],
      mostEffectivePhase: '',
      mostAffectedTable: ''
    };

    // Group by phase
    const phaseMap = new Map<string, CleanupPhaseStats>();
    const tableSet = new Set<string>();
    let maxRemoved = 0;
    let maxTableRemoved = 0;
    let mostEffectivePhase = '';
    let mostAffectedTable = '';

    results.forEach(result => {
      // Add to total
      summary.totalRecordsRemoved += result.total_removed;
      summary.totalSpaceSaved += result.space_saved_mb;
      tableSet.add(result.table_name);

      // Group by phase
      if (!phaseMap.has(result.phase)) {
        phaseMap.set(result.phase, {
          phase: result.phase,
          totalRemoved: 0,
          spaceSaved: 0,
          tablesAffected: []
        });
      }

      const phase = phaseMap.get(result.phase)!;
      phase.totalRemoved += result.total_removed;
      phase.spaceSaved += result.space_saved_mb;
      if (!phase.tablesAffected.includes(result.table_name)) {
        phase.tablesAffected.push(result.table_name);
      }

      // Track most effective phase
      if (result.total_removed > maxRemoved) {
        maxRemoved = result.total_removed;
        mostEffectivePhase = result.phase;
      }

      // Track most affected table
      if (result.total_removed > maxTableRemoved) {
        maxTableRemoved = result.total_removed;
        mostAffectedTable = result.table_name;
      }
    });

    summary.phases = Array.from(phaseMap.values());
    summary.tablesAffected = Array.from(tableSet);
    summary.mostEffectivePhase = mostEffectivePhase;
    summary.mostAffectedTable = mostAffectedTable;

    return summary;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Automatic Egress Optimizer
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Reduces Supabase costs by cleaning redundant position data while preserving all meaningful RP changes and maintaining 6-hour position tracking resolution for smooth animations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {schedulerSettings.enabled && (
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {lastAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Records Removed</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {lastAnalysis.totalRecordsRemoved.toLocaleString()}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">total across all phases</p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Space Saved</span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {lastAnalysis.totalSpaceSaved.toFixed(2)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">MB</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Cost Reduction</span>
            </div>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              ~{Math.round(lastAnalysis.totalSpaceSaved * 0.1 * 100) / 100}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">USD/month</p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Phases</span>
            </div>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {lastAnalysis.phases.length}
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">cleanup phases</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Manual Controls */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manual Controls</h3>
          
          <button
            onClick={runCleanup}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Cleanup...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Cleanup Now</span>
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
            </div>
          )}
        </div>

        {/* Scheduler Controls */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Automatic Scheduling</h3>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={schedulerSettings.enabled}
                onChange={(e) => handleSchedulerToggle(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable automatic cleanup</span>
            </label>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Frequency
              </label>
              <select
                value={schedulerSettings.frequency}
                onChange={(e) => handleFrequencyChange(e.target.value as SchedulerSettings['frequency'])}
                disabled={!schedulerSettings.enabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="every_2_days">Every 2 Days</option>
                <option value="every_3_days">Every 3 Days</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Next run: {getNextRunDisplay()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Results */}
      {lastAnalysis && (
        <div className="mb-6">
          <button
            onClick={() => setShowDetailedResults(!showDetailedResults)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {showDetailedResults ? (
              <>
                <ChevronDown className="w-4 h-4" />
                Hide Detailed Results
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                Show Detailed Results
              </>
            )}
          </button>

          {showDetailedResults && (
            <div className="mt-4 space-y-6">
              {/* Phase Breakdown */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Phase Breakdown</h4>
                <div className="space-y-3">
                  {lastAnalysis.phases.map((phase, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{phase.phase}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Tables: {phase.tablesAffected.join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {phase.totalRemoved.toLocaleString()} records
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {phase.spaceSaved.toFixed(2)} MB saved
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Impact */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Table Impact</h4>
                <div className="space-y-3">
                  {lastResult && Object.entries(lastResult.reduce((acc, result) => {
                    if (!acc[result.table_name]) {
                      acc[result.table_name] = { totalRemoved: 0, spaceSaved: 0, phases: [] };
                    }
                    acc[result.table_name].totalRemoved += result.total_removed;
                    acc[result.table_name].spaceSaved += result.space_saved_mb;
                    if (!acc[result.table_name].phases.includes(result.phase)) {
                      acc[result.table_name].phases.push(result.phase);
                    }
                    return acc;
                  }, {} as Record<string, { totalRemoved: number; spaceSaved: number; phases: string[] }>)).map(([tableName, stats]) => (
                    <div key={tableName} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{tableName}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Phases: {stats.phases.join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {stats.totalRemoved.toLocaleString()} records
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {stats.spaceSaved.toFixed(2)} MB saved
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Key Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Most Effective Phase</div>
                    <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{lastAnalysis.mostEffectivePhase}</div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <div className="text-sm font-medium text-green-700 dark:text-green-300">Most Affected Table</div>
                    <div className="text-lg font-bold text-green-900 dark:text-green-100">{lastAnalysis.mostAffectedTable}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cleanup History */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Cleanup History</h3>
        
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cleanupHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No cleanup history yet. Run your first cleanup to see results here.
            </p>
          ) : (
            cleanupHistory.map((entry) => (
              <div
                key={entry.id}
                className={`p-4 rounded-lg border ${
                  entry.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {entry.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    entry.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                  }`}>
                    {entry.status}
                  </span>
                </div>
                
                {entry.status === 'success' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Records removed:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {entry.totalRecordsRemoved.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Space saved:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {entry.totalSpaceSaved.toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                    {entry.results.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Phases: {entry.results.map(r => r.phase).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Error: {entry.error}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EgressOptimizer; 