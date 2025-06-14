import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Play, X, Save } from 'lucide-react';

interface PresenceTestResult {
  presenceMethod?: 'proxy' | 'direct';
  userPresenceType?: number;
  placeId?: number | null;
  rootPlaceId?: number | null;
  universeId?: number | null;
  inBedwars?: boolean;
  gameId?: string | null;
  lastUpdated?: number;
}

const RobloxCookiePanel: React.FC = () => {
  const [cookie, setCookie] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PresenceTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const verifyAndSaveCookie = async () => {
    setError(null);
    setSuccess(null);
    const trimmedCookie = cookie.trim();

    try {
      // Validate cookie format
      if (!trimmedCookie) {
        throw new Error('Please enter a .ROBLOSECURITY cookie');
      }
      
      if (!trimmedCookie.startsWith('_|WARNING:-DO-NOT-SHARE-THIS')) {
        throw new Error('Invalid .ROBLOSECURITY cookie format');
      }

      // Test the cookie with a presence check
      const { data, error } = await supabase.functions.invoke('roblox-status', {
        body: { userId: 77146135 } // Test user ID
      });

      if (error) {
        throw new Error(error.message || 'Failed to verify cookie');
      }

      if (!data) {
        throw new Error('No response data received');
      }

      // If we get here, the cookie works
      setSuccess('Cookie verified successfully! Please set this cookie in your Supabase environment variables as ROBLOX_COOKIE');
      setError(null);
    } catch (err) {
      console.error('Error verifying cookie:', err);
      const msg = err instanceof Error ? err.message : 'Failed to verify cookie';
      setError(msg);
      setSuccess(null);
    }
  };

  const runPresenceTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    const TEST_USER_ID = 77146135;

    try {
      const { data, error } = await supabase.functions.invoke('roblox-status', {
        body: { userId: TEST_USER_ID }
      });

      if (error) {
        console.error('Presence test error:', error);
        throw new Error(error.message || 'Failed to test presence');
      }

      if (!data) {
        throw new Error('No response data received');
      }

      // Log the full response for debugging
      console.log('Presence test response:', {
        ...data,
        lastUpdated: new Date(data.lastUpdated).toLocaleString()
      });

      setTestResult(data as any);
    } catch (err) {
      console.error('Presence test failed:', err);
      const msg = err instanceof Error ? err.message : 'Presence test failed';
      setTestError(msg);
    } finally {
      setTesting(false);
      setShowTestModal(true);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Roblox Admin Cookie</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Set the admin .ROBLOSECURITY cookie to enable player tracking for all users.
        This cookie will be used by the edge function to check player presence.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded flex items-center">
          <AlertCircle className="mr-2" size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
          {success}
          <div className="mt-2 text-sm">
            <p>To set the cookie in Supabase:</p>
            <ol className="list-decimal list-inside mt-1">
              <li>Go to your Supabase project dashboard</li>
              <li>Navigate to Settings → Edge Functions</li>
              <li>Add environment variable: ROBLOX_COOKIE</li>
              <li>Paste the verified cookie value</li>
              <li>Save and redeploy the edge function</li>
            </ol>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <textarea
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          rows={3}
          placeholder="Paste .ROBLOSECURITY cookie here"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={verifyAndSaveCookie}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save size={18} />
            Verify Cookie
          </button>
          <button
            type="button"
            onClick={runPresenceTest}
            disabled={testing}
            className="btn btn-outline flex items-center gap-2"
          >
            <Play size={18} />
            {testing ? 'Testing...' : 'Test Presence'}
          </button>
        </div>
      </div>

      {testResult && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Last Proxy Used:{' '}
            {testResult.presenceMethod === 'proxy' ? 'roblox-proxy' : 'direct'}
          </p>
          <p>Last Updated: {new Date(testResult.lastUpdated || 0).toLocaleString()}</p>
        </div>
      )}

      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Presence Test</h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            {testing ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : testError ? (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                {testError}
              </div>
            ) : (
              <div className="space-y-2">
                {testResult?.presenceMethod && (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">API Method:</span>{' '}
                      {testResult.presenceMethod === 'proxy' ? 'roblox-proxy' : 'direct'}
                    </p>
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      {testResult.userPresenceType === 0
                        ? 'Offline'
                        : testResult.userPresenceType === 1
                        ? 'Online'
                        : 'In Game'}
                    </p>
                    {testResult.inBedwars && (
                      <p className="text-green-600 dark:text-green-400">
                        Currently in Bedwars
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Last Updated:</span>{' '}
                      {new Date(testResult.lastUpdated || 0).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RobloxCookiePanel;
