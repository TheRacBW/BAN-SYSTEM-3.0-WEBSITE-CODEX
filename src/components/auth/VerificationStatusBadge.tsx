import React from 'react';
import { Shield, Lock, CheckCircle, User, Crown } from 'lucide-react';
import { UserVerificationStatus } from '../../hooks/usePageAccess';
import { getTrustLevelBadge } from '../../types/trustLevels';

interface VerificationStatusBadgeProps {
  userStatus: UserVerificationStatus | null;
  showDetails?: boolean;
  className?: string;
}

const TRUST_LEVEL_ICONS = {
  0: User,
  0.5: Shield,
  1: Crown,
  2: CheckCircle,
  3: Crown
};

const TRUST_LEVEL_COLORS = {
  0: 'text-gray-500',
  0.5: 'text-blue-500',
  1: 'text-yellow-500',
  2: 'text-green-500',
  3: 'text-purple-500'
};

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  userStatus,
  showDetails = false,
  className = ''
}) => {
  if (!userStatus) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
        <User size={16} />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  const badge = getTrustLevelBadge(userStatus.trust_level);
  const IconComponent = TRUST_LEVEL_ICONS[userStatus.trust_level as keyof typeof TRUST_LEVEL_ICONS] || User;
  const textColor = TRUST_LEVEL_COLORS[userStatus.trust_level as keyof typeof TRUST_LEVEL_COLORS] || 'text-gray-500';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex items-center gap-1 ${textColor}`}>
        <IconComponent size={16} />
        <span className="text-sm font-medium">{badge.name}</span>
      </div>
      
      {showDetails && (
        <div className="flex items-center gap-2 ml-2 text-xs text-gray-400">
          {userStatus.is_discord_verified && (
            <div className="flex items-center gap-1 text-blue-400">
              <Shield size={12} />
              <span>Discord</span>
            </div>
          )}
          {userStatus.is_paid_tracker_verified && (
            <div className="flex items-center gap-1 text-yellow-400">
              <Crown size={12} />
              <span>Paid</span>
            </div>
          )}
          {userStatus.is_admin && (
            <div className="flex items-center gap-1 text-purple-400">
              <Crown size={12} />
              <span>Admin</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};