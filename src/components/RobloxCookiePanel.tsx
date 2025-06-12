import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Save, Play, X } from 'lucide-react';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';

interface PresenceAttempt {
  method: 'primary' | 'fallback' | 'direct';
  success: boolean;
}

interface PresenceTestResult {
  presenceMethod?: 'primary' | 'fallback' | 'direct';
  attemptLog?: PresenceAttempt[];
  cookieProvided?: boolean;
  userPresenceType?: number;
  placeId?: number | null;
  rootPlaceId?: number | null;
  universeId?: number | null;
  inBedwars?: boolean;
  gameId?: string | null;
}

const RobloxCookiePanel: React.FC = () => {
  const [cookie, setCookie] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  // Quick sanity check that env variables are loaded in the browser
  console.log(
    'Supabase ENV',
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  const [testResult, setTestResult] = useState<PresenceTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testMethod, setTestMethod] = useState<'auto' | 'primary' | 'fallback' | 'direct'>('auto');

  useEffect(() => {
    const fetchCookie = async () => {
      try {
        const { data } = await supabase
          .from('roblox_settings')
          .select('cookie')
          .eq('id', 'global')
          .single();
        if (data?.cookie) setCookie(data.cookie);
      } catch (err) {
        console.error('Error fetching cookie:', err);
        setError('Failed to load cookie');
      } finally {
        setLoading(false);
      }
    };
    fetchCookie();
  }, []);

  interface VerifyResponse {
    success: boolean;
    name?: string;
    error?: string;
  }

  const verifyCookie = async (value: string): Promise<VerifyResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-cookie', {
        body: { cookie: value }
      });
      if (error) {
        console.error('verify-cookie response error:', error);
        throw new Error('Failed to verify cookie');
      }
      return data as VerifyResponse;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Network error contacting verify-cookie';
      console.error('verify-cookie network error:', err);
      throw new Error(message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = cookie.trim();
    try {
      const result = await verifyCookie(trimmed);

      if (result.success) {
        setSuccess(`Cookie saved for ${result.name}`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Error saving cookie:', err);
      const message = err instanceof Error ? err.message : 'Failed to save cookie';
      setError(message);
    }
  };

  const runPresenceTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    const TEST_USER_ID = 77146135;
    try {
      const methodQuery = testMethod === 'auto' ? '' : `&method=${testMethod}`;
      const path = `roblox-status?userId=${TEST_USER_ID}${methodQuery}`;
      const headers: Record<string, string> = {};
      const trimmedCookie = cookie.trim();
      if (trimmedCookie) {
        headers['Cookie'] = `.ROBLOSECURITY=${trimmedCookie}`;
      }
      const { data, error } = await supabase.functions.invoke(path, {
        headers
      });
      if (error) throw error;
      setTestResult(data as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Presence test failed';
      setTestError(msg);
    } finally {
      setTesting(false);
      setShowTestModal(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Roblox Cookie</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Provide your .ROBLOSECURITY cookie to enable online and Bedwars detection.
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
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <textarea
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          rows={3}
          placeholder="Paste .ROBLOSECURITY cookie here"
        />
        <div>
          <label className="block text-sm mb-1">Presence API</label>
          <select
            value={testMethod}
            onChange={(e) =>
              setTestMethod(e.target.value as 'auto' | 'primary' | 'fallback' | 'direct')
            }
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="auto">Auto</option>
            <option value="primary">RAC Proxy</option>
            <option value="fallback">RoProxy</option>
            <option value="direct">Roblox API</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex items-center gap-2">
            <Save size={18} />
            Save Cookie
          </button>
          <button
            type="button"
            onClick={runPresenceTest}
            className="btn btn-outline flex items-center gap-2"
          >
            <Play size={18} />
            Test Presence
          </button>
        </div>
      </form>

      {testResult && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Last Proxy Used:{' '}
            {testResult.presenceMethod === 'primary'
              ? 'roblox-proxy'
              : testResult.presenceMethod === 'fallback'
              ? 'roproxy'
              : 'direct'}
          </p>
          <p>Cookie Applied: {testResult.cookieProvided ? 'yes' : 'no'}</p>
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
                      <span
                        className="underline decoration-dotted cursor-help"
                        title={`Used API: ${
                          testResult.presenceMethod === 'primary'
                            ? 'roblox-proxy.theraccoonmolester.workers.dev'
                            : testResult.presenceMethod === 'fallback'
                            ? 'presence.roproxy.com'
                            : 'presence.roblox.com'
                        }`}
                      >
                        API Method: {testResult.presenceMethod}
                      </span>
                    </p>
                    <p>
                      Proxy Used:{' '}
                      {testResult.presenceMethod === 'primary'
                        ? 'roblox-proxy'
                        : testResult.presenceMethod === 'fallback'
                        ? 'roproxy'
                        : 'direct'}
                    </p>
                    <p>
                      Cookie Applied: {testResult.cookieProvided ? 'yes' : 'no'}
                    </p>
                    {Array.isArray(testResult.attemptLog) && (
                      <p className="flex gap-2">
                        {(testResult.attemptLog || []).map((a: PresenceAttempt, idx: number) => (
                          <span key={idx} className="flex items-center gap-1">
                            {a.success ? '✅' : '❌'}{' '}
                            {a.method === 'primary'
                              ? 'theraccoonmolester'
                              : a.method === 'fallback'
                              ? 'roproxy'
                              : 'roblox'}
                          </span>
                        ))}
                      </p>
                    )}
                    {!testResult.cookieProvided && (
                      <p className="text-xs text-red-500">
                        Cookie was missing or invalid
                      </p>
                    )}
                    <div
                      className="text-xs text-gray-500"
                      title={`presenceType=${testResult.userPresenceType}; inGame=${testResult.userPresenceType===2}; bedwarsMatch=${
                        testResult.inBedwars ||
                        Number(testResult.placeId) === BEDWARS_PLACE_ID ||
                        Number(testResult.rootPlaceId) === BEDWARS_PLACE_ID ||
                        Number(testResult.universeId) === BEDWARS_UNIVERSE_ID
                      }`}
                    >
                      <ul className="list-disc ml-4">
                        <li>userPresenceType: {testResult.userPresenceType}</li>
                        <li>In Bedwars: {testResult.inBedwars ? 'yes' : 'no'}</li>
                        <li>
                          Missing IDs:{' '}
                          {!testResult.placeId || !testResult.universeId
                            ? 'yes'
                            : 'no'}
                        </li>
                        <li>
                          Cookie Provided:{' '}
                          {testResult.cookieProvided ? 'yes' : 'no'}
                        </li>
                        <li>Game ID: {testResult.gameId || 'n/a'}</li>
                        <li>Universe ID: {testResult.universeId ?? 'n/a'}</li>
                      </ul>
                    </div>
                    <p className="text-xs mt-1">
                      [ A collection of User Presences Roblox.Presence.Api.Models.Response.UserPresence ]
                    </p>
                  </div>
                )}
                <pre className="text-sm whitespace-pre-wrap break-all">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RobloxCookiePanel;
