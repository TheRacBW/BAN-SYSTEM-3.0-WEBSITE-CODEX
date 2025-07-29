import React from 'react';
import { Shield, Lock, ExternalLink, CheckCircle, AlertCircle, User, Crown, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#232b36] rounded-lg p-6 max-w-md w-full border border-[#3a4250] shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-200">Access Required</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
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