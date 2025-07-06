import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Play,
  Pause,
  Settings,
  BarChart3,
  Activity,
  Zap,
  Shield,
  Target
} from 'lucide-react';
import { migrationCoordinator, MigrationCoordinatorState } from '../../lib/migrationCoordinator';
import { UsernameChangeData, UsernameChangeStatistics } from '../../lib/usernameChangeManager';
import MigrationProgress from './MigrationProgress';
import MigrationStats from './MigrationStats';
import UsernameChangeCard from './UsernameChangeCard';

interface MigrationDashboardProps {
  className?: string;
}

const MigrationDashboard: React.FC<MigrationDashboardProps> = ({ className = '' }) => {
  // State management
  const [coordinatorState, setCoordinatorState] = useState<MigrationCoordinatorState>({
    isRunning: false,
    currentStep: '',
    overallProgress: 0,
    usernameChanges: [],
    statistics: null,
    lastError: null
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({
    databaseReady: true,
    edgeFunctionReady: true,
    migrationReady: true,
    lastCheck: new Date()
  });

  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Callbacks for coordinator
  const handleStateChange = useCallback((state: MigrationCoordinatorState) => {
    setCoordinatorState(state);
  }, []);

  const handleUsernameChangesDetected = useCallback((changes: UsernameChangeData[]) => {
    setCoordinatorState(prev => ({ ...prev, usernameChanges: changes }));
  }, []);

  const handleStatisticsUpdated = useCallback((stats: UsernameChangeStatistics) => {
    setCoordinatorState(prev => ({ ...prev, statistics: stats }));
  }, []);

  // Initialize coordinator with callbacks
  useEffect(() => {
    migrationCoordinator.reset();
    
    // Set up callbacks
    const callbacks = {
      onStateChanged: handleStateChange,
      onUsernameChangesDetected: handleUsernameChangesDetected,
      onStatisticsUpdated: handleStatisticsUpdated,
      onLog: (message: string, level?: 'info' | 'warning' | 'error') => {
        console.log(`[${level?.toUpperCase() || 'INFO'}] ${message}`);
      }
    };

    // Initialize coordinator (this would be done in a real implementation)
    // For now, we'll simulate the state
    setCoordinatorState({
      isRunning: false,
      currentStep: '',
      overallProgress: 0,
      usernameChanges: [],
      statistics: null,
      lastError: null
    });

    // Load initial data
    loadRecentActivity();
    checkSystemHealth();
  }, [handleStateChange, handleUsernameChangesDetected, handleStatisticsUpdated]);

  // Load recent activity from username_change_log
  const loadRecentActivity = async () => {
    try {
      // This would be a real database query
      const mockActivity = [
        {
          id: 1,
          old_username: 'player1',
          new_username: 'player1_new',
          status: 'merged',
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          merged_by: 'admin'
        },
        {
          id: 2,
          old_username: 'player2',
          new_username: 'player2_updated',
          status: 'pending',
          created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          merged_by: null
        }
      ];
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  };

  // Check system health
  const checkSystemHealth = async () => {
    try {
      // This would check various system components
      const health = {
        databaseReady: true,
        edgeFunctionReady: true,
        migrationReady: true,
        lastCheck: new Date()
      };
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to check system health:', error);
    }
  };

  // Quick action handlers
  const handleStartMigration = async () => {
    try {
      await migrationCoordinator.startFullMigration();
    } catch (error) {
      console.error('Failed to start migration:', error);
    }
  };

  const handleDetectChanges = async () => {
    try {
      await migrationCoordinator.detectUsernameChanges();
    } catch (error) {
      console.error('Failed to detect changes:', error);
    }
  };

  const handleRefreshStats = async () => {
    try {
      await migrationCoordinator.refreshStatistics();
    } catch (error) {
      console.error('Failed to refresh statistics:', error);
    }
  };

  const handleBulkMerge = async () => {
    if (selectedChanges.size === 0) return;

    try {
      const changesToMerge = coordinatorState.usernameChanges.filter(change => 
        selectedChanges.has(`${change.old_username}-${change.new_username}`)
      );

      const result = await migrationCoordinator.bulkMergeChanges(
        changesToMerge.map(change => ({
          old_username: change.old_username,
          new_username: change.new_username,
          user_id: change.user_id
        }))
      );

      console.log('Bulk merge result:', result);
      setSelectedChanges(new Set());
    } catch (error) {
      console.error('Failed to bulk merge:', error);
    }
  };

  // Toggle change selection
  const toggleChangeSelection = (change: UsernameChangeData) => {
    const key = `${change.old_username}-${change.new_username}`;
    setSelectedChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'merged': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'pending': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'rejected': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Get health status
  const getHealthStatus = () => {
    const allHealthy = systemHealth.databaseReady && 
                      systemHealth.edgeFunctionReady && 
                      systemHealth.migrationReady;
    
    return {
      status: allHealthy ? 'healthy' : 'warning',
      color: allHealthy ? 'text-green-600' : 'text-yellow-600',
      icon: allHealthy ? CheckCircle : AlertTriangle
    };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RP Migration Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage the migration from username-based to user_id-based tracking</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <HealthIcon className={`w-5 h-5 ${healthStatus.color}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                System {healthStatus.status}
              </span>
            </div>
            <button
              onClick={checkSystemHealth}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Migration Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Migration Progress</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round(coordinatorState.overallProgress)}%
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${coordinatorState.overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Username Changes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Username Changes</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {coordinatorState.usernameChanges.length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {coordinatorState.statistics?.totalMerged || 0} merged
          </div>
        </div>

        {/* Processing Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Processing</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {coordinatorState.statistics?.totalMerged || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {coordinatorState.statistics?.averageConfidence ? 
              `${Math.round(coordinatorState.statistics.averageConfidence * 100)}% confidence` : 
              'No data'
            }
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">System Status</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {coordinatorState.isRunning ? 'Running' : 'Idle'}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Database className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {coordinatorState.currentStep || 'No active step'}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={handleStartMigration}
            disabled={coordinatorState.isRunning}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>Start Migration</span>
          </button>

          <button
            onClick={handleDetectChanges}
            disabled={coordinatorState.isRunning}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Detect Changes</span>
          </button>

          <button
            onClick={handleRefreshStats}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Stats</span>
          </button>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced</span>
          </button>
        </div>
      </div>

      {/* Migration Progress */}
      <MigrationProgress 
        isRunning={coordinatorState.isRunning}
        currentStep={coordinatorState.currentStep}
        overallProgress={coordinatorState.overallProgress}
        lastError={coordinatorState.lastError}
      />

      {/* Username Changes Section */}
      {coordinatorState.usernameChanges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Username Changes</h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedChanges.size} of {coordinatorState.usernameChanges.length} selected
              </span>
              {selectedChanges.size > 0 && (
                <button
                  onClick={handleBulkMerge}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Merge Selected
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {coordinatorState.usernameChanges.map((change, index) => (
              <UsernameChangeCard
                key={`${change.old_username}-${change.new_username}`}
                change={change}
                selected={selectedChanges.has(`${change.old_username}-${change.new_username}`)}
                onToggleSelection={() => toggleChangeSelection(change)}
                onMerge={async () => {
                  try {
                    await migrationCoordinator.mergeUsernameChange(
                      change.old_username,
                      change.new_username,
                      change.user_id
                    );
                  } catch (error) {
                    console.error('Failed to merge change:', error);
                  }
                }}
                onReject={async () => {
                  try {
                    await migrationCoordinator.rejectUsernameChange(
                      change.old_username,
                      change.new_username,
                      change.user_id
                    );
                  } catch (error) {
                    console.error('Failed to reject change:', error);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Statistics Dashboard */}
      <MigrationStats 
        statistics={coordinatorState.statistics}
        isRunning={coordinatorState.isRunning}
      />

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                  {activity.status}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.old_username} → {activity.new_username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {activity.merged_by && (
                <span className="text-xs text-gray-500 dark:text-gray-400">by {activity.merged_by}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Section */}
      {showAdvanced && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advanced Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => migrationCoordinator.abort()}
              disabled={!coordinatorState.isRunning}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Abort Migration
            </button>
            <button
              onClick={() => migrationCoordinator.reset()}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Reset State
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MigrationDashboard; 