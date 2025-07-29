import React from 'react';
import { Shield, Lock, CheckCircle, User, Crown, ExternalLink, ArrowRight } from 'lucide-react';
import { UserVerificationStatus } from '../../hooks/usePageAccess';
import { VerificationStatusBadge } from './VerificationStatusBadge';
import { TRUST_LEVEL_CONFIGS } from '../../types/trustLevels';

interface UserVerificationDashboardProps {
  userStatus: UserVerificationStatus | null;
  className?: string;
}

const DISCORD_SERVER_URL = 'https://discord.gg/zRwZS6pRZ3';

export const UserVerificationDashboard: React.FC<UserVerificationDashboardProps> = ({
  userStatus,
  className = ''
}) => {
  if (!userStatus) {
    return (
      <div className={`bg-[#232b36] rounded-lg p-6 border border-[#3a4250] ${className}`}>
        <div className="flex items-center gap-2 text-gray-400">
          <User size={20} />
          <span>Loading verification status...</span>
        </div>
      </div>
    );
  }

  const currentTrustLevel = userStatus.trust_level;
  const nextTrustLevel = TRUST_LEVEL_CONFIGS.find(config => config.level > currentTrustLevel);

  const getNextSteps = () => {
    const steps = [];

    // Discord verification step
    if (!userStatus.is_discord_verified && currentTrustLevel < 0.5) {
      steps.push({
        title: 'Verify Discord Account',
        description: 'Join our Discord server and verify your account to unlock more features.',
        icon: Shield,
        action: () => window.open(DISCORD_SERVER_URL, '_blank'),
        actionText: 'Join Discord',
        color: 'text-blue-400',
        completed: false
      });
    }

    // Paid tracker verification step
    if (!userStatus.is_paid_tracker_verified && currentTrustLevel < 1) {
      steps.push({
        title: 'Upgrade to Paid Tracker',
        description: 'Purchase a paid tracker subscription to access premium features.',
        icon: Crown,
        action: () => window.location.href = '/upgrade',
        actionText: 'View Plans',
        color: 'text-yellow-400',
        completed: false
      });
    }

    // Trust level progression
    if (nextTrustLevel) {
      steps.push({
        title: `Advance to ${nextTrustLevel.label}`,
        description: `Continue using the platform to advance your trust level and unlock more features.`,
        icon: ArrowRight,
        action: null,
        actionText: '',
        color: 'text-green-400',
        completed: false
      });
    }

    return steps;
  };

  const nextSteps = getNextSteps();

  return (
    <div className={`bg-[#232b36] rounded-lg p-6 border border-[#3a4250] ${className}`}>
      <h2 className="text-xl font-bold text-gray-200 mb-6">Verification Dashboard</h2>

      {/* Current Status */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Current Status</h3>
        <div className="bg-[#2a323c] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <VerificationStatusBadge userStatus={userStatus} showDetails={true} />
            <div className="text-xs text-gray-400">
              Member since {new Date(userStatus.created_at).toLocaleDateString()}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Shield size={16} className={userStatus.is_discord_verified ? 'text-blue-400' : 'text-gray-500'} />
              <span className={userStatus.is_discord_verified ? 'text-blue-400' : 'text-gray-400'}>
                Discord {userStatus.is_discord_verified ? 'Verified' : 'Not Verified'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Crown size={16} className={userStatus.is_paid_tracker_verified ? 'text-yellow-400' : 'text-gray-500'} />
              <span className={userStatus.is_paid_tracker_verified ? 'text-yellow-400' : 'text-gray-400'}>
                Paid Tracker {userStatus.is_paid_tracker_verified ? 'Verified' : 'Not Verified'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Level Progress */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Trust Level Progress</h3>
        <div className="bg-[#2a323c] rounded-lg p-4">
          <div className="space-y-3">
            {TRUST_LEVEL_CONFIGS.map((config, index) => (
              <div key={config.level} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  config.level <= currentTrustLevel 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-600 text-gray-400'
                }`}>
                  {config.level <= currentTrustLevel ? <CheckCircle size={12} /> : index + 1}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${
                    config.level <= currentTrustLevel ? 'text-white' : 'text-gray-400'
                  }`}>
                    {config.icon} {config.label}
                  </div>
                  <div className="text-xs text-gray-500">{config.description}</div>
                </div>
                {config.level === currentTrustLevel && (
                  <span className="text-xs text-blue-400 font-medium">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Next Steps</h3>
          <div className="space-y-3">
            {nextSteps.map((step, index) => (
              <div key={index} className="bg-[#2a323c] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <step.icon size={20} className={step.color} />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-200 mb-1">{step.title}</h4>
                    <p className="text-xs text-gray-400 mb-3">{step.description}</p>
                    {step.action && (
                      <button
                        onClick={step.action}
                        className="btn btn-sm btn-primary flex items-center gap-2"
                      >
                        {step.actionText}
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discord Instructions */}
      {!userStatus.is_discord_verified && (
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Discord Verification</h4>
          <p className="text-xs text-gray-300 mb-3">
            Join our Discord server and verify your account to unlock additional features.
          </p>
          <div className="text-xs text-gray-400 space-y-1">
            <div>1. Click "Join Discord" below</div>
            <div>2. Use the command: <code className="bg-blue-900/50 px-1 rounded">/verify {userStatus.email}</code></div>
            <div>3. Stay in the server to maintain verification</div>
          </div>
          <button
            onClick={() => window.open(DISCORD_SERVER_URL, '_blank')}
            className="btn btn-sm btn-primary mt-3 flex items-center gap-2"
          >
            <Shield size={14} />
            Join Discord Server
            <ExternalLink size={12} />
          </button>
        </div>
      )}
    </div>
  );
};