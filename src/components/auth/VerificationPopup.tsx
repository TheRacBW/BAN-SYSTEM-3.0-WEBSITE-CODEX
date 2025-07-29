import React from 'react';
import { Shield, Lock, ExternalLink, CheckCircle, AlertCircle, User, Crown, X, ArrowRight } from 'lucide-react';
import { UserVerificationStatus, PageAccessRequirements } from '../../hooks/usePageAccess';
import { VerificationStatusBadge } from './VerificationStatusBadge';
import { getTrustLevelConfig } from '../../types/trustLevels';

interface VerificationPopupProps {
  userStatus: UserVerificationStatus;
  requirement: PageAccessRequirements;
  onClose: () => void;
  onRecheck: () => void;
}

const DISCORD_SERVER_URL = 'https://discord.gg/zRwZS6pRZ3';

export const VerificationPopup: React.FC<VerificationPopupProps> = ({
  userStatus,
  requirement,
  onClose,
  onRecheck
}) => {
  const currentTrustConfig = getTrustLevelConfig(userStatus.trust_level as any);
  const requiredTrustConfig = getTrustLevelConfig(requirement.min_trust_level as any);

  const getActionButton = () => {
    // Discord verification needed
    if (requirement.requires_discord_verification && !userStatus.is_discord_verified) {
      return {
        text: 'Join Discord & Verify',
        icon: Shield,
        action: () => window.open(DISCORD_SERVER_URL, '_blank'),
        color: 'btn-primary',
        description: 'Join our Discord server and use `/verify [email]` to verify your account.'
      };
    }

    // Paid tracker verification needed
    if (requirement.requires_paid_verification && !userStatus.is_paid_tracker_verified) {
      return {
        text: 'Upgrade to Paid Tracker',
        icon: Crown,
        action: () => window.location.href = '/upgrade',
        color: 'btn-warning',
        description: 'Purchase a paid tracker subscription to access this feature.'
      };
    }

    // Trust level too low
    if (userStatus.trust_level < requirement.min_trust_level) {
      return {
        text: 'Contact Admin',
        icon: AlertCircle,
        action: () => window.location.href = '/contact',
        color: 'btn-secondary',
        description: 'Contact an administrator to request access to this page.'
      };
    }

    return null;
  };

  const actionButton = getActionButton();

  const getProgressSteps = () => {
    const steps = [];
    
    // Step 1: Account created (always completed if userStatus exists)
    steps.push({
      completed: true,
      title: 'Account Created',
      description: 'You have successfully created an account',
      icon: CheckCircle
    });

    // Step 2: Discord verification
    if (requirement.requires_discord_verification) {
      steps.push({
        completed: userStatus.is_discord_verified,
        title: 'Discord Verification',
        description: userStatus.is_discord_verified 
          ? 'Discord account verified successfully'
          : 'Join Discord server and use /verify command',
        icon: userStatus.is_discord_verified ? CheckCircle : Shield
      });
    }

    // Step 3: Paid tracker verification (if required)
    if (requirement.requires_paid_verification) {
      steps.push({
        completed: userStatus.is_paid_tracker_verified,
        title: 'Paid Tracker Verification',
        description: userStatus.is_paid_tracker_verified
          ? 'Paid tracker subscription verified'
          : 'Purchase paid tracker subscription',
        icon: userStatus.is_paid_tracker_verified ? CheckCircle : Crown
      });
    }

    return steps;
  };

  const progressSteps = getProgressSteps();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#232b36] rounded-lg p-6 max-w-lg w-full border border-[#3a4250] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-200">Access Required</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Verification Progress</h3>
          <div className="space-y-3">
            {progressSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step.completed 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  <step.icon size={16} />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${
                    step.completed ? 'text-green-400' : 'text-gray-200'
                  }`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-400">
                    {step.description}
                  </div>
                </div>
                {index < progressSteps.length - 1 && (
                  <ArrowRight size={16} className="text-gray-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Your Current Status</h3>
          <div className="bg-[#2a323c] rounded-lg p-3">
            <VerificationStatusBadge userStatus={userStatus} showDetails={true} />
            <div className="mt-2 text-xs text-gray-400">
              Trust Level: {currentTrustConfig.label}
            </div>
          </div>
        </div>

        {/* Required Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Required for Access</h3>
          <div className="bg-[#2a323c] rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 ${requirement.min_trust_level >= 0.5 ? 'text-blue-500' : 'text-gray-500'}`}>
                {requirement.requires_discord_verification ? <Shield size={16} /> : <User size={16} />}
                <span className="text-sm font-medium">{requiredTrustConfig.label}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Minimum Trust Level: {requiredTrustConfig.label}
              {requirement.requires_discord_verification && (
                <div className="mt-1 text-blue-400">• Discord verification required</div>
              )}
              {requirement.requires_paid_verification && (
                <div className="mt-1 text-yellow-400">• Paid tracker verification required</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {actionButton && (
          <div className="mb-4">
            <button
              onClick={actionButton.action}
              className={`btn ${actionButton.color} w-full flex items-center justify-center gap-2`}
            >
              <actionButton.icon size={16} />
              {actionButton.text}
              <ExternalLink size={14} />
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {actionButton.description}
            </p>
          </div>
        )}

        {/* Discord Instructions */}
        {requirement.requires_discord_verification && !userStatus.is_discord_verified && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Discord Verification Steps:</h4>
            <ol className="text-xs text-gray-300 space-y-1">
              <li>1. Join our Discord server</li>
              <li>2. Use the command: <code className="bg-blue-900/50 px-1 rounded">/verify {userStatus.email}</code></li>
              <li>3. Stay in the server to maintain verification</li>
            </ol>
            <div className="mt-3 text-xs text-blue-300">
              <strong>Note:</strong> After verifying, you may need to wait a few minutes for the verification to process.
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-2">
          <button
            onClick={onRecheck}
            className="btn btn-ghost flex-1 text-gray-300"
          >
            Recheck Access
          </button>
          <button
            onClick={onClose}
            className="btn btn-outline flex-1 text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};