import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Users, 
  Merge, 
  Eye, 
  CheckSquare, 
  Square,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Settings,
  Zap
} from 'lucide-react';
import { leaderboardService } from '../../../services/leaderboardService';

// Types for migration state
interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
  details?: any;
}

interface UsernameChange {
  old_username: string;
  new_username: string;
  user_id: number;
  confidence_score: number;
  evidence: {
    rp_difference?: number;
    rank_difference?: number;
    timing?: string;
  };
  selected: boolean;
}

interface BatchProgress {
  processed: number;
  updated: number;
  fromCache: number;
  fromApi: number;
  failed: number;
  errors: string[];
  hasMore: boolean;
}

interface MigrationStats {
  totalRecords: number;
  processedRecords: number;
  successRate: number;
  estimatedTimeRemaining: number;
}

const MigrationInterface: React.FC = () => {
  // Migration state
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([
    {
      id: 'database-setup',
      title: 'Database Setup',
      description: 'Verify user_id columns and helper functions are in place',
      status: 'completed',
      progress: 100
    },
    {
      id: 'backfill-rp-changes',
      title: 'Backfill rp_changes Table',
      description: 'Update existing records with user_id values',
      status: 'pending',
      progress: 0
    },
    {
      id: 'backfill-rp-changes-optimized',
      title: 'Backfill rp_changes_optimized Table',
      description: 'Update optimized table with user_id values',
      status: 'pending',
      progress: 0
    },
    {
      id: 'detect-username-changes',
      title: 'Detect Username Changes',
      description: 'Identify users who have changed their usernames',
      status: 'pending',
      progress: 0
    },
    {
      id: 'review-username-changes',
      title: 'Review Username Changes',
      description: 'Manually review and merge detected username changes',
      status: 'pending',
      progress: 0
    },
    {
      id: 'update-leaderboard',
      title: 'Update Leaderboard Table',
      description: 'Backfill leaderboard table with user_id values',
      status: 'pending',
      progress: 0
    },
    {
      id: 'verify-migration',
      title: 'Verify Migration Completeness',
      description: 'Run final verification checks',
      status: 'pending',
      progress: 0
    }
  ]);

  // Username changes state
  const [usernameChanges, setUsernameChanges] = useState<UsernameChange[]>([]);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [showUsernameChanges, setShowUsernameChanges] = useState(false);

  // Batch processing state
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [migrationStats, setMigrationStats] = useState<MigrationStats>({
    totalRecords: 0,
    processedRecords: 0,
    successRate: 0,
    estimatedTimeRemaining: 0
  });

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [logs, setLogs] = useState<string[]>([]);

  // Helper function to add logs
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Helper function to update migration step
  const updateMigrationStep = useCallback((stepId: string, updates: Partial<MigrationStep>) => {
    setMigrationSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  // Helper function to toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Process batch backfill with progress tracking
  const processBatchBackfill = useCallback(async (table: 'rp_changes' | 'rp_changes_optimized', stepId: string) => {
    updateMigrationStep(stepId, { status: 'running', progress: 0 });
    addLog(`Starting backfill for ${table} table...`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalFromCache = 0;
    let totalFromApi = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    try {
      let hasMore = true;
      let batchNumber = 0;

      while (hasMore) {
        batchNumber++;
        addLog(`Processing batch ${batchNumber} for ${table}...`);

        const result = await leaderboardService.triggerUserIdBackfill(table, 100, false);
        
        if (!result.success) {
          throw new Error(`Batch ${batchNumber} failed: ${result.errors?.join(', ')}`);
        }

        // Update totals
        totalProcessed += result.processed || 0;
        totalUpdated += result.updated || 0;
        totalFromCache += result.fromCache || 0;
        totalFromApi += result.fromApi || 0;
        totalFailed += result.failed || 0;
        
        if (result.errors) {
          allErrors.push(...result.errors);
        }

        // Update progress
        const progress = Math.min((totalProcessed / 1000) * 100, 100); // Estimate based on 1000 records
        updateMigrationStep(stepId, { progress });

        // Update batch progress for UI
        setBatchProgress({
          processed: totalProcessed,
          updated: totalUpdated,
          fromCache: totalFromCache,
          fromApi: totalFromApi,
          failed: totalFailed,
          errors: allErrors,
          hasMore: result.hasMore || false
        });

        hasMore = result.hasMore || false;

        // Add small delay to prevent overwhelming the API
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      updateMigrationStep(stepId, { 
        status: 'completed', 
        progress: 100,
        details: {
          totalProcessed,
          totalUpdated,
          totalFromCache,
          totalFromApi,
          totalFailed,
          errors: allErrors
        }
      });

      addLog(`✅ Completed backfill for ${table}: ${totalUpdated} records updated`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateMigrationStep(stepId, { 
        status: 'failed', 
        error: errorMessage 
      });
      addLog(`❌ Failed to backfill ${table}: ${errorMessage}`);
    }
  }, [updateMigrationStep, addLog]);

  // Detect username changes
  const detectUsernameChanges = useCallback(async () => {
    const stepId = 'detect-username-changes';
    updateMigrationStep(stepId, { status: 'running', progress: 0 });
    addLog('Detecting username changes...');

    try {
      const result = await leaderboardService.detectUsernameChanges();
      
      if (result && Array.isArray(result)) {
        const changes: UsernameChange[] = result.map((change: any) => ({
          old_username: change.old_username,
          new_username: change.new_username,
          user_id: change.user_id,
          confidence_score: change.confidence_score || 0,
          evidence: {
            rp_difference: change.rp_difference,
            rank_difference: change.rank_difference,
            timing: change.timing
          },
          selected: false
        }));

        setUsernameChanges(changes);
        updateMigrationStep(stepId, { 
          status: 'completed', 
          progress: 100,
          details: { changesCount: changes.length }
        });
        addLog(`✅ Detected ${changes.length} username changes`);
      } else {
        updateMigrationStep(stepId, { 
          status: 'completed', 
          progress: 100,
          details: { changesCount: 0 }
        });
        addLog('✅ No username changes detected');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateMigrationStep(stepId, { 
        status: 'failed', 
        error: errorMessage 
      });
      addLog(`❌ Failed to detect username changes: ${errorMessage}`);
    }
  }, [updateMigrationStep, addLog]);

  // Merge selected username changes
  const mergeSelectedChanges = useCallback(async () => {
    const stepId = 'review-username-changes';
    updateMigrationStep(stepId, { status: 'running', progress: 0 });
    
    const selectedChangesList = usernameChanges.filter(change => 
      selectedChanges.has(`${change.old_username}-${change.new_username}`)
    );

    addLog(`Merging ${selectedChangesList.length} selected username changes...`);

    try {
      let processed = 0;
      for (const change of selectedChangesList) {
        await leaderboardService.mergeUsernameChanges();
        processed++;
        
        const progress = (processed / selectedChangesList.length) * 100;
        updateMigrationStep(stepId, { progress });
      }

      updateMigrationStep(stepId, { 
        status: 'completed', 
        progress: 100,
        details: { mergedCount: selectedChangesList.length }
      });
      addLog(`✅ Successfully merged ${selectedChangesList.length} username changes`);
      
      // Clear selections
      setSelectedChanges(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateMigrationStep(stepId, { 
        status: 'failed', 
        error: errorMessage 
      });
      addLog(`❌ Failed to merge username changes: ${errorMessage}`);
    }
  }, [usernameChanges, selectedChanges, updateMigrationStep, addLog]);

  // Toggle username change selection
  const toggleUsernameChangeSelection = useCallback((change: UsernameChange) => {
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
  }, []);

  // Start full migration
  const startFullMigration = useCallback(async () => {
    setIsProcessing(true);
    addLog('🚀 Starting full migration process...');

    try {
      // Step 2: Backfill rp_changes
      await processBatchBackfill('rp_changes', 'backfill-rp-changes');
      
      // Step 3: Backfill rp_changes_optimized
      await processBatchBackfill('rp_changes_optimized', 'backfill-rp-changes-optimized');
      
      // Step 4: Detect username changes
      await detectUsernameChanges();
      
      // Step 5: Review username changes (manual step - just mark as ready)
      updateMigrationStep('review-username-changes', { 
        status: 'pending', 
        progress: 0 
      });
      
      // Step 6: Update leaderboard table
      await processBatchBackfill('leaderboard', 'update-leaderboard');
      
      // Step 7: Verify migration
      updateMigrationStep('verify-migration', { 
        status: 'completed', 
        progress: 100 
      });

      addLog('🎉 Full migration completed successfully!');
    } catch (error) {
      addLog(`❌ Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [processBatchBackfill, detectUsernameChanges, updateMigrationStep, addLog]);

  // Execute individual step
  const executeStep = useCallback(async (stepId: string) => {
    switch (stepId) {
      case 'backfill-rp-changes':
        await processBatchBackfill('rp_changes', stepId);
        break;
      case 'backfill-rp-changes-optimized':
        await processBatchBackfill('rp_changes_optimized', stepId);
        break;
      case 'detect-username-changes':
        await detectUsernameChanges();
        break;
      case 'review-username-changes':
        // This is a manual step, just mark as ready
        updateMigrationStep(stepId, { status: 'pending', progress: 0 });
        break;
      case 'update-leaderboard':
        await processBatchBackfill('leaderboard', stepId);
        break;
      case 'verify-migration':
        updateMigrationStep(stepId, { status: 'completed', progress: 100 });
        break;
    }
  }, [processBatchBackfill, detectUsernameChanges, updateMigrationStep]);

  // Get status icon
  const getStatusIcon = (status: MigrationStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  // Calculate overall progress
  const overallProgress = migrationSteps.reduce((sum, step) => sum + step.progress, 0) / migrationSteps.length;
  const completedSteps = migrationSteps.filter(step => step.status === 'completed').length;
  const failedSteps = migrationSteps.filter(step => step.status === 'failed').length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RP System Migration</h1>
            <p className="text-gray-600 mt-1">Migrate from username-based to user_id-based tracking</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">Overall Progress</div>
              <div className="text-2xl font-bold text-blue-600">{Math.round(overallProgress)}%</div>
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Migration Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Migration Steps</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>{completedSteps} completed</span>
              <span>•</span>
              <span>{failedSteps} failed</span>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {migrationSteps.map((step) => (
            <div key={step.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(step.status)}
                  <div>
                    <h3 className="font-medium text-gray-900">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12">{Math.round(step.progress)}%</span>
                  {step.status === 'pending' && (
                    <button
                      onClick={() => executeStep(step.id)}
                      disabled={isProcessing}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {step.error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700">{step.error}</span>
                  </div>
                </div>
              )}
              
              {step.details && (
                <div className="mt-3 text-sm text-gray-600">
                  {step.details.changesCount !== undefined && (
                    <div>Detected {step.details.changesCount} username changes</div>
                  )}
                  {step.details.mergedCount !== undefined && (
                    <div>Merged {step.details.mergedCount} username changes</div>
                  )}
                  {step.details.totalUpdated !== undefined && (
                    <div>Updated {step.details.totalUpdated} records</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Username Changes Section */}
      {usernameChanges.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Username Changes</h2>
              <button
                onClick={() => setShowUsernameChanges(!showUsernameChanges)}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
              >
                {showUsernameChanges ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span>{showUsernameChanges ? 'Hide' : 'Show'} Details</span>
              </button>
            </div>
          </div>
          
          {showUsernameChanges && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {selectedChanges.size} of {usernameChanges.length} selected
                </div>
                <button
                  onClick={mergeSelectedChanges}
                  disabled={selectedChanges.size === 0 || isProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  <Merge className="w-4 h-4 mr-2" />
                  Merge Selected
                </button>
              </div>
              
              <div className="space-y-3">
                {usernameChanges.map((change, index) => {
                  const key = `${change.old_username}-${change.new_username}`;
                  const isSelected = selectedChanges.has(key);
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => toggleUsernameChangeSelection(change)}
                          className="flex items-center justify-center w-5 h-5"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{change.old_username}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium">{change.new_username}</span>
                            <span className="text-sm text-gray-500">(ID: {change.user_id})</span>
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                            <span>Confidence: {Math.round(change.confidence_score * 100)}%</span>
                            {change.evidence.rp_difference && (
                              <span>RP Diff: {change.evidence.rp_difference}</span>
                            )}
                            {change.evidence.rank_difference && (
                              <span>Rank Diff: {change.evidence.rank_difference}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Progress */}
      {batchProgress && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch Processing Progress</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{batchProgress.processed}</div>
              <div className="text-sm text-gray-500">Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{batchProgress.updated}</div>
              <div className="text-sm text-gray-500">Updated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{batchProgress.fromCache}</div>
              <div className="text-sm text-gray-500">From Cache</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{batchProgress.fromApi}</div>
              <div className="text-sm text-gray-500">From API</div>
            </div>
          </div>
          
          {batchProgress.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm font-medium text-red-700 mb-2">Errors ({batchProgress.errors.length})</div>
              <div className="text-sm text-red-600 space-y-1">
                {batchProgress.errors.slice(0, 5).map((error, index) => (
                  <div key={index}>• {error}</div>
                ))}
                {batchProgress.errors.length > 5 && (
                  <div>... and {batchProgress.errors.length - 5} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Migration Actions</h2>
            <p className="text-sm text-gray-600 mt-1">Execute migration steps individually or run the full process</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setMigrationSteps(prev => prev.map(step => ({ ...step, status: 'pending', progress: 0, error: undefined })));
                setBatchProgress(null);
                setLogs([]);
              }}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </button>
            
            <button
              onClick={startFullMigration}
              disabled={isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              Start Full Migration
            </button>
          </div>
        </div>
      </div>

      {/* Logs Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Migration Logs</h2>
            <button
              onClick={() => toggleSection('logs')}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-700"
            >
              {expandedSections.has('logs') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>{expandedSections.has('logs') ? 'Hide' : 'Show'} Logs</span>
            </button>
          </div>
        </div>
        
        {expandedSections.has('logs') && (
          <div className="p-6">
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Tab Visibility Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8 p-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">MMR Calculator Info Tab Visibility</h2>
        <p className="text-sm text-gray-600 mb-2">Control whether the Info tab in the MMR Calculator is visible to everyone or only to admins. This is useful if you want to keep the system a secret until your video is released.</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localStorage.getItem('mmrInfoTabAdminOnly') !== 'false'}
              onChange={e => {
                localStorage.setItem('mmrInfoTabAdminOnly', e.target.checked ? 'true' : 'false');
                window.dispatchEvent(new Event('mmrInfoTabAdminOnlyChanged'));
              }}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-gray-800">Restrict Info tab to admins only</span>
          </label>
          <span className="text-xs text-gray-500">(Uncheck to make it public for all users)</span>
        </div>
      </div>
    </div>
  );
};

export default MigrationInterface; 