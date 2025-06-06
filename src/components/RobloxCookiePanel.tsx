import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Save, Play, X } from 'lucide-react';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';

const RobloxCookiePanel: React.FC = () => {
  const [cookie, setCookie] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
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

  const verifyCookie = async (value: string): Promise<string> => {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: {
        Cookie: `.ROBLOSECURITY=${value}`,
        'User-Agent': 'Roblox/WinInet'
      }
    });
    if (!res.ok) {
      throw new Error(`Cookie verification failed (${res.status})`);
    }
    const data = await res.json();
    return data.name as string;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = cookie.trim();
    try {
      const username = await verifyCookie(trimmed);
      const { error } = await supabase
        .from('roblox_settings')
        .upsert({ id: 'global', cookie: trimmed, updated_at: new Date().toISOString() });
      if (error) throw error;
      setSuccess(`Cookie saved for ${username}`);
      setTimeout(() => setSuccess(null), 3000);
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
      }
      const methodQuery = testMethod === 'auto' ? '' : `&method=${testMethod}`;
      const apiUrl = `${supabaseUrl}/functions/v1/roblox-status?userId=${TEST_USER_ID}${methodQuery}`;
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Request failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      setTestResult(data);
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
            onChange={(e) => setTestMethod(e.target.value as any)}
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
                    {Array.isArray(testResult.attemptLog) && (
                      <p className="flex gap-2">
                        {testResult.attemptLog.map((a: any, idx: number) => (
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
