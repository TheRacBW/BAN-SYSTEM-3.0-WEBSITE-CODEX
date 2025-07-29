import React, { useState } from 'react';
import { usePageAccess, UserVerificationStatus, PageAccessRequirements } from '../../hooks/usePageAccess';
import { VerificationPopup } from './VerificationPopup';

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
  const { hasAccess, requirement, userStatus, loading, error, recheckAccess } = usePageAccess(pagePath);
  const [showPopup, setShowPopup] = useState(false);

  // Show loading spinner while checking access
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="text-gray-400">Checking access...</p>
        </div>
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

  // If user doesn't have access and we have requirements, show popup
  if (userStatus && requirement) {
    return (
      <>
        {fallbackComponent || (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <div className="text-gray-400 mb-2">🔒 Access Required</div>
              <p className="text-gray-500 text-sm mb-4">
                This page requires {requirement.min_trust_level >= 0.5 ? 'Discord verification' : 'higher trust level'}.
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
            requirement={requirement}
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