import React, { useState } from 'react';
import { useCachedPageAccess } from '../../hooks/useCachedPageAccess';
import { VerificationPopup } from './VerificationPopup';
import { useAuth } from '../../context/AuthContext';
import { usePageAccess, UserVerificationStatus, PageAccessRequirements } from '../../hooks/usePageAccess';

interface VerificationGuardProps {
  children: React.ReactNode;
  pagePath: string;
  fallbackComponent?: React.ReactNode;
}

export const VerificationGuard: React.FC<VerificationGuardProps> = ({
  children,
  pagePath,
  fallbackComponent
}) => {
  const { user } = useAuth();
  const { hasAccess, loading, error, requirement, recheckAccess } = useCachedPageAccess(pagePath);
  const { userStatus } = usePageAccess(pagePath); // Keep for user status details
  const [showPopup, setShowPopup] = useState(false);

  // Much faster loading - only shows for uncached pages
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show error if something went wrong
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ Access Check Error</div>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button 
            onClick={recheckAccess}
            className="btn btn-sm btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If user has access, show the content
  if (hasAccess) {
    return <>{children}</>;
  }

  // If no requirement found, show fallback or default message
  if (!requirement) {
    return (
      <>
        {fallbackComponent || (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <div className="text-gray-400 mb-2">🔒 Access Restricted</div>
              <p className="text-gray-500 text-sm">This page requires special access.</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // User is not logged in at all - show Account Required message
  if (!user) {
    return (
      <>
        {fallbackComponent || (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center max-w-md">
              <div className="text-gray-400 mb-4 text-4xl">🔐</div>
              <h2 className="text-xl font-bold text-gray-200 mb-2">Account Required</h2>
              <p className="text-gray-400 mb-4">
                You need to create an account to access this page. 
                {requirement.requiresDiscordVerification && ' After creating an account, you\'ll also need to verify through Discord.'}
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => window.location.href = '/auth'}
                  className="btn btn-primary w-full"
                >
                  Create Account
                </button>
                <p className="text-xs text-gray-500">
                  Already have an account? <a href="/auth" className="text-blue-400 hover:underline">Sign in</a>
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // User is logged in but doesn't meet requirements - show Verification Required message
  if (userStatus && requirement) {
    return (
      <>
        {fallbackComponent || (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center max-w-md">
              <div className="text-gray-400 mb-4 text-4xl">🔒</div>
              <h2 className="text-xl font-bold text-gray-200 mb-2">Verification Required</h2>
              <p className="text-gray-400 mb-4">
                {requirement.requiresDiscordVerification && !userStatus.is_discord_verified 
                  ? 'This page requires Discord verification. Join our Discord server and verify your account to continue.'
                  : 'This page requires additional verification to access.'
                }
              </p>
              <button 
                onClick={() => setShowPopup(true)}
                className="btn btn-primary"
              >
                View Requirements
              </button>
            </div>
          </div>
        )}

        {showPopup && (
          <VerificationPopup
            userStatus={userStatus}
            requirement={{
              page_path: pagePath,
              min_trust_level: requirement.minTrustLevel,
              requires_discord_verification: requirement.requiresDiscordVerification,
              requires_paid_verification: requirement.requiresPaidVerification,
              description: ''
            }}
            onClose={() => setShowPopup(false)}
            onRecheck={async () => {
              await recheckAccess();
              setShowPopup(false);
            }}
          />
        )}
      </>
    );
  }

  // Fallback for any other case
  return (
    <>
      {fallbackComponent || (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="text-gray-400 mb-2">⚠️ Unable to Check Access</div>
            <p className="text-gray-500 text-sm">Please try refreshing the page.</p>
          </div>
        </div>
      )}
    </>
  );
};