import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  User,
  Clock,
  TrendingUp,
  AlertTriangle,
  Info
} from 'lucide-react';
import { UsernameChangeData } from '../../lib/usernameChangeManager';

interface UsernameChangeCardProps {
  change: UsernameChangeData;
  selected: boolean;
  onToggleSelection: () => void;
  onMerge: () => Promise<void>;
  onReject: () => Promise<void>;
}

const UsernameChangeCard: React.FC<UsernameChangeCardProps> = ({
  change,
  selected,
  onToggleSelection,
  onMerge,
  onReject
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  // Handle merge action
  const handleMerge = async () => {
    setIsProcessing(true);
    try {
      await onMerge();
    } catch (error) {
      console.error('Failed to merge change:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reject action
  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } catch (error) {
      console.error('Failed to reject change:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format evidence for display
  const formatEvidence = () => {
    const evidence = [];
    
    if (change.evidence.rp_difference !== undefined) {
      evidence.push({
        label: 'RP Difference',
        value: change.evidence.rp_difference,
        icon: TrendingUp,
        color: change.evidence.rp_difference < 100 ? 'text-green-600' : 'text-yellow-600'
      });
    }
    
    if (change.evidence.rank_difference !== undefined) {
      evidence.push({
        label: 'Rank Difference',
        value: change.evidence.rank_difference,
        icon: TrendingUp,
        color: change.evidence.rank_difference < 2 ? 'text-green-600' : 'text-yellow-600'
      });
    }
    
    if (change.evidence.timing) {
      evidence.push({
        label: 'Timing',
        value: change.evidence.timing,
        icon: Clock,
        color: 'text-blue-600'
      });
    }
    
    return evidence;
  };

  const evidence = formatEvidence();
  const confidenceColor = getConfidenceColor(change.confidence_score);
  const confidenceLabel = getConfidenceLabel(change.confidence_score);

  return (
    <div className={`border rounded-lg p-4 transition-all duration-200 ${
      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelection}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900">{change.old_username}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{change.new_username}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${confidenceColor}`}>
            {confidenceLabel} ({Math.round(change.confidence_score * 100)}%)
          </span>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* User ID */}
      <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
        <User className="w-4 h-4" />
        <span>User ID: {change.user_id}</span>
      </div>

      {/* Status */}
      <div className="flex items-center space-x-2 mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          change.status === 'merged' ? 'text-green-600 bg-green-100' :
          change.status === 'pending' ? 'text-yellow-600 bg-yellow-100' :
          change.status === 'rejected' ? 'text-red-600 bg-red-100' :
          'text-gray-600 bg-gray-100'
        }`}>
          {change.status.charAt(0).toUpperCase() + change.status.slice(1)}
        </span>
        
        {change.merged_at && (
          <span className="text-xs text-gray-500">
            {new Date(change.merged_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Evidence (when expanded) */}
      {expanded && evidence.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Info className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Evidence</span>
          </div>
          
          <div className="space-y-2">
            {evidence.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-gray-600">{item.label}:</span>
                  </div>
                  <span className={`font-medium ${item.color}`}>
                    {typeof item.value === 'number' ? item.value : item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {change.status === 'pending' && (
        <div className="flex items-center space-x-2">
          <button
            onClick={handleMerge}
            disabled={isProcessing}
            className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Approve</span>
          </button>
          
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span>Reject</span>
          </button>
          
          {isProcessing && (
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}

      {/* Merged/Rejected Status */}
      {change.status !== 'pending' && (
        <div className="flex items-center space-x-2 text-sm">
          {change.status === 'merged' ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-green-600">Successfully merged</span>
            </>
          ) : change.status === 'rejected' ? (
            <>
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600">Rejected</span>
            </>
          ) : null}
          
          {change.merged_by && (
            <span className="text-gray-500">by {change.merged_by}</span>
          )}
        </div>
      )}

      {/* Warning for low confidence */}
      {change.confidence_score < 0.6 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              Low confidence score. Please review carefully before approving.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsernameChangeCard; 