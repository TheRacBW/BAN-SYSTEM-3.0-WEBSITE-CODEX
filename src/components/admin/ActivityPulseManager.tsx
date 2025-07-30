import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Settings,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import {
  triggerDailyReset,
  triggerDataCleanup,
  setupScheduling,
  getSystemHealth,
  getActivityStats,
  checkMaintenanceNeeded,
  getManualSchedulingInstructions,
  type ActivityPulseHealth,
  type MaintenanceResult
} from '../../lib/activityPulseMaintenance';

interface ActivityPulseManagerProps {
  isAdmin?: boolean;
}

const ActivityPulseManager: React.FC<ActivityPulseManagerProps> = ({ isAdmin = false }) => {
  const [health, setHealth] = useState<ActivityPulseHealth | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    needsReset: boolean;
    needsCleanup: boolean;
    recommendations: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<MaintenanceResult | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadSystemData();
    }
  }, [isAdmin]);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [healthData, statsData, maintenanceData] = await Promise.all([
        getSystemHealth(),
        getActivityStats(),
        checkMaintenanceNeeded()
      ]);
      
      setHealth(healthData);
      setStats(statsData);
      setMaintenanceStatus(maintenanceData);
    } catch (error) {
      console.error('Error loading system data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDailyReset = async () => {
    setLoading(true);
    const result = await triggerDailyReset();
    setLastAction(result);
    if (result.success) {
      await loadSystemData();
    }
    setLoading(false);
  };

  const handleDataCleanup = async () => {
    setLoading(true);
    const result = await triggerDataCleanup();
    setLastAction(result);
    if (result.success) {
      await loadSystemData();
    }
    setLoading(false);
  };

  const handleSetupScheduling = async () => {
    setLoading(true);
    const result = await setupScheduling();
    setLastAction(result);
    setLoading(false);
  };

  const getActivityLevel = (minutes: number) => {
    if (minutes >= 120) return { level: 'Very Active', color: 'text-green-600', icon: '🔥' };
    if (minutes >= 60) return { level: 'Moderately Active', color: 'text-yellow-600', icon: '⚡' };
    if (minutes >= 15) return { level: 'Lightly Active', color: 'text-blue-600', icon: '💧' };
    return { level: 'Inactive', color: 'text-gray-500', icon: '😴' };
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-semibold">Activity Pulse Manager</h2>
        </div>
        <button
          onClick={loadSystemData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Action Results */}
      {lastAction && (
        <div className={`p-4 rounded-lg ${
          lastAction.success 
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {lastAction.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <span className={lastAction.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
              {lastAction.message}
            </span>
          </div>
          {lastAction.error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{lastAction.error}</p>
          )}
        </div>
      )}

      {/* System Health Overview */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Users</span>
            </div>
            <p className="text-2xl font-bold">{health.totalUsers}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Today</span>
            </div>
            <p className="text-2xl font-bold">{health.activeToday}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Daily (min)</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(health.avgDailyMinutes)}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Reset Today</span>
            </div>
            <p className="text-2xl font-bold">{health.resetToday}</p>
          </div>
        </div>
      )}

      {/* Maintenance Status */}
      {maintenanceStatus && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Maintenance Status
          </h3>
          
          <div className="space-y-3">
            {maintenanceStatus.needsReset && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-yellow-800 dark:text-yellow-200">Daily reset needed</span>
              </div>
            )}
            
            {maintenanceStatus.needsCleanup && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg">
                <Trash2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="text-orange-800 dark:text-orange-200">Data cleanup recommended</span>
              </div>
            )}
            
            {maintenanceStatus.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Recommendations:</h4>
                <ul className="space-y-1">
                  {maintenanceStatus.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Maintenance Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleDailyReset}
            disabled={loading}
            className="flex items-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Daily Reset</span>
          </button>
          
          <button
            onClick={handleDataCleanup}
            disabled={loading}
            className="flex items-center gap-2 p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" />
            <span>Data Cleanup</span>
          </button>
          
          <button
            onClick={handleSetupScheduling}
            disabled={loading}
            className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
          >
            <Calendar className="w-5 h-5" />
            <span>Setup Scheduling</span>
          </button>
        </div>
        
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          {showInstructions ? 'Hide' : 'Show'} Manual Scheduling Instructions
        </button>
      </div>

      {/* Manual Scheduling Instructions */}
      {showInstructions && (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Manual Scheduling Instructions</h3>
          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
            {getManualSchedulingInstructions()}
          </pre>
        </div>
      )}

      {/* Activity Statistics */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Activity Statistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trend Distribution */}
            <div>
              <h4 className="font-medium mb-3">Activity Trends</h4>
              <div className="space-y-2">
                {Object.entries(stats.trendDistribution).map(([trend, count]) => (
                  <div key={trend} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(trend)}
                      <span className="capitalize">{trend}</span>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Time Period Distribution */}
            <div>
              <h4 className="font-medium mb-3">Preferred Time Periods</h4>
              <div className="space-y-2">
                {Object.entries(stats.timePeriodDistribution).map(([period, count]) => (
                  <div key={period} className="flex items-center justify-between">
                    <span className="capitalize">{period}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityPulseManager; 