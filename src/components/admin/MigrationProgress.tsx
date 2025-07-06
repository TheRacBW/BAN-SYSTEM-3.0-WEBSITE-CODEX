import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Zap,
  Database,
  Users,
  Merge,
  Eye,
  Settings
} from 'lucide-react';

interface MigrationProgressProps {
  isRunning: boolean;
  currentStep: string;
  overallProgress: number;
  lastError: string | null;
  className?: string;
}

const MigrationProgress: React.FC<MigrationProgressProps> = ({
  isRunning,
  currentStep,
  overallProgress,
  lastError,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Migration steps configuration
  const migrationSteps = [
    {
      id: 'database-setup',
      title: 'Database Setup',
      description: 'Verify user_id columns and helper functions',
      icon: Database,
      status: 'completed' as const
    },
    {
      id: 'backfill-rp-changes',
      title: 'Backfill rp_changes Table',
      description: 'Update existing records with user_id values',
      icon: Database,
      status: currentStep === 'backfill-rp-changes' ? (isRunning ? 'running' : 'pending') : 'pending'
    },
    {
      id: 'backfill-rp-changes-optimized',
      title: 'Backfill rp_changes_optimized Table',
      description: 'Update optimized table with user_id values',
      icon: Database,
      status: currentStep === 'backfill-rp-changes-optimized' ? (isRunning ? 'running' : 'pending') : 'pending'
    },
    {
      id: 'detect-username-changes',
      title: 'Detect Username Changes',
      description: 'Identify users who have changed their usernames',
      icon: Users,
      status: currentStep === 'detect-username-changes' ? (isRunning ? 'running' : 'pending') : 'pending'
    },
    {
      id: 'review-username-changes',
      title: 'Review Username Changes',
      description: 'Manually review and merge detected changes',
      icon: Eye,
      status: currentStep === 'review-username-changes' ? (isRunning ? 'running' : 'pending') : 'pending'
    },
    {
      id: 'update-leaderboard',
      title: 'Update Leaderboard Table',
      description: 'Backfill leaderboard table with user_id values',
      icon: Database,
      status: currentStep === 'update-leaderboard' ? (isRunning ? 'running' : 'pending') : 'pending'
    },
    {
      id: 'verify-migration',
      title: 'Verify Migration Completeness',
      description: 'Run final verification checks',
      icon: CheckCircle,
      status: currentStep === 'verify-migration' ? (isRunning ? 'running' : 'pending') : 'pending'
    }
  ];

  // Get status icon
  const getStatusIcon = (status: 'pending' | 'running' | 'completed' | 'failed') => {
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

  // Get step progress
  const getStepProgress = (stepId: string) => {
    if (stepId === currentStep && isRunning) {
      return Math.min(overallProgress, 95); // Don't show 100% until completed
    }
    if (migrationSteps.find(s => s.id === stepId)?.status === 'completed') {
      return 100;
    }
    return 0;
  };

  // Get step status
  const getStepStatus = (stepId: string) => {
    const step = migrationSteps.find(s => s.id === stepId);
    if (!step) return 'pending';
    
    if (step.status === 'completed') return 'completed';
    if (stepId === currentStep && isRunning) return 'running';
    if (stepId === currentStep && !isRunning && lastError) return 'failed';
    return 'pending';
  };

  // Get overall status
  const getOverallStatus = () => {
    if (lastError) return 'error';
    if (isRunning) return 'running';
    if (overallProgress === 100) return 'completed';
    return 'idle';
  };

  const overallStatus = getOverallStatus();

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Migration Progress</h2>
              <p className="text-sm text-gray-600">
                {isRunning ? 'Migration in progress...' : 'Ready to start migration'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Overall Progress */}
            <div className="text-right">
              <div className="text-sm text-gray-500">Overall Progress</div>
              <div className="text-2xl font-bold text-blue-600">{Math.round(overallProgress)}%</div>
            </div>
            
            {/* Status Badge */}
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              overallStatus === 'completed' ? 'bg-green-100 text-green-800' :
              overallStatus === 'running' ? 'bg-blue-100 text-blue-800' :
              overallStatus === 'error' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {overallStatus === 'completed' ? 'Completed' :
               overallStatus === 'running' ? 'Running' :
               overallStatus === 'error' ? 'Error' : 'Idle'}
            </div>
            
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* Overall Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                overallStatus === 'completed' ? 'bg-green-500' :
                overallStatus === 'running' ? 'bg-blue-500' :
                overallStatus === 'error' ? 'bg-red-500' :
                'bg-gray-400'
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {lastError && (
        <div className="p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Migration Error</h3>
              <p className="text-sm text-red-700 mt-1">{lastError}</p>
              
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                {showErrorDetails ? 'Hide' : 'Show'} error details
              </button>
              
              {showErrorDetails && (
                <div className="mt-3 p-3 bg-red-100 rounded-lg">
                  <pre className="text-xs text-red-800 whitespace-pre-wrap">
                    {lastError}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step Details (when expanded) */}
      {expanded && (
        <div className="p-6">
          <div className="space-y-4">
            {migrationSteps.map((step, index) => {
              const Icon = step.icon;
              const stepStatus = getStepStatus(step.id);
              const stepProgress = getStepProgress(step.id);
              
              return (
                <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {index + 1}. {step.title}
                          </span>
                          {getStatusIcon(stepStatus)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Progress</div>
                      <div className="text-lg font-bold text-blue-600">{Math.round(stepProgress)}%</div>
                    </div>
                  </div>
                  
                  {/* Step Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          stepStatus === 'completed' ? 'bg-green-500' :
                          stepStatus === 'running' ? 'bg-blue-500' :
                          stepStatus === 'failed' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${stepProgress}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Step Status */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                      stepStatus === 'completed' ? 'text-green-600' :
                      stepStatus === 'running' ? 'text-blue-600' :
                      stepStatus === 'failed' ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {stepStatus === 'completed' ? 'Completed' :
                       stepStatus === 'running' ? 'In Progress' :
                       stepStatus === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                    
                    {stepStatus === 'running' && (
                      <div className="flex items-center space-x-2 text-xs text-blue-600">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Current Step Info */}
          {isRunning && currentStep && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Play className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Currently Processing</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Step: {migrationSteps.find(s => s.id === currentStep)?.title || currentStep}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Completion Celebration */}
          {overallProgress === 100 && !isRunning && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">Migration Completed!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    All steps have been completed successfully.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MigrationProgress; 