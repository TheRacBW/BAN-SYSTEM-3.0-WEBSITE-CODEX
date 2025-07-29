import React from 'react';
import { VerificationGuard, UserVerificationDashboard, VerificationStatusBadge } from '../components/auth';
import { usePageAccess } from '../hooks/usePageAccess';

const VerificationDemoPage: React.FC = () => {
  const { userStatus } = usePageAccess('/verification-demo');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-200 mb-8">Verification System Demo</h1>

      {/* User Status Badge */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Your Current Status</h2>
        <div className="bg-[#232b36] rounded-lg p-4 border border-[#3a4250]">
          <VerificationStatusBadge userStatus={userStatus} showDetails={true} />
        </div>
      </div>

      {/* Verification Dashboard */}
      <div className="mb-8">
        <UserVerificationDashboard userStatus={userStatus} />
      </div>

      {/* Protected Content Examples */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Protected Content Examples</h2>
          
          {/* Basic Access (New users) */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Basic Access (New users)</h3>
            <VerificationGuard pagePath="/basic-access">
              <div className="bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
                <h4 className="text-lg font-medium text-gray-200 mb-2">✅ Basic Content</h4>
                <p className="text-gray-300">This content is available to all users with basic access.</p>
              </div>
            </VerificationGuard>
          </div>

          {/* Discord Verified Access */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Discord Verified Access</h3>
            <VerificationGuard pagePath="/discord-verified">
              <div className="bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
                <h4 className="text-lg font-medium text-gray-200 mb-2">🔗 Discord Verified Content</h4>
                <p className="text-gray-300">This content requires Discord verification (trust level 0.5+).</p>
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-300">
                    This section shows content that's only available to Discord-verified users.
                  </p>
                </div>
              </div>
            </VerificationGuard>
          </div>

          {/* Paid Tracker Access */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Paid Tracker Access</h3>
            <VerificationGuard pagePath="/paid-tracker">
              <div className="bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
                <h4 className="text-lg font-medium text-gray-200 mb-2">💎 Paid Tracker Content</h4>
                <p className="text-gray-300">This content requires paid tracker verification (trust level 1+).</p>
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-300">
                    This section shows premium content for paid tracker subscribers.
                  </p>
                </div>
              </div>
            </VerificationGuard>
          </div>

          {/* Trusted User Access */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Trusted User Access</h3>
            <VerificationGuard pagePath="/trusted">
              <div className="bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
                <h4 className="text-lg font-medium text-gray-200 mb-2">🤝 Trusted User Content</h4>
                <p className="text-gray-300">This content requires trusted status (trust level 2+).</p>
                <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-green-300">
                    This section shows content for trusted users who have proven themselves.
                  </p>
                </div>
              </div>
            </VerificationGuard>
          </div>

          {/* Moderator Access */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Moderator Access</h3>
            <VerificationGuard pagePath="/moderator">
              <div className="bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
                <h4 className="text-lg font-medium text-gray-200 mb-2">🛡️ Moderator Content</h4>
                <p className="text-gray-300">This content requires moderator status (trust level 3+).</p>
                <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                  <p className="text-sm text-purple-300">
                    This section shows administrative and moderation tools.
                  </p>
                </div>
              </div>
            </VerificationGuard>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="mt-12 bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">How to Use VerificationGuard</h2>
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <h3 className="font-medium text-gray-200 mb-2">1. Protect Any Page</h3>
            <pre className="bg-[#2a323c] p-3 rounded text-xs overflow-x-auto">
{`<VerificationGuard pagePath="/strategies">
  <StrategiesPageContent />
</VerificationGuard>`}
            </pre>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-200 mb-2">2. Show User Status</h3>
            <pre className="bg-[#2a323c] p-3 rounded text-xs overflow-x-auto">
{`<VerificationStatusBadge userStatus={userStatus} showDetails={true} />`}
            </pre>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-200 mb-2">3. Add to User Profile</h3>
            <pre className="bg-[#2a323c] p-3 rounded text-xs overflow-x-auto">
{`<UserVerificationDashboard userStatus={userStatus} />`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationDemoPage;