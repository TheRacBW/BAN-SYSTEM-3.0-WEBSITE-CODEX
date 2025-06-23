import React, { useState, useEffect } from 'react';
import { leaderboardService } from '../services/leaderboardService';
import { robloxApi } from '../services/robloxApi';
import { supabase } from '../lib/supabase';

export const TestLeaderboardData: React.FC = () => {
  const [testResults, setTestResults] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTests = async () => {
    setIsLoading(true);
    setError(null);
    const results: any = {};

    try {
      console.log('🧪 Starting comprehensive leaderboard tests...');

      // Test 1: Check Supabase connection
      console.log('Test 1: Checking Supabase connection...');
      try {
        const { data, error } = await supabase.from('leaderboard').select('count').limit(1);
        results.supabaseConnection = {
          success: !error,
          error: error?.message,
          data: data
        };
        console.log('✅ Supabase connection test:', results.supabaseConnection);
      } catch (err) {
        results.supabaseConnection = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        console.error('❌ Supabase connection test failed:', err);
      }

      // Test 2: Check table structure
      console.log('Test 2: Checking table structure...');
      try {
        const { data: tables, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public');
        
        results.tableStructure = {
          success: !error,
          error: error?.message,
          tables: tables?.map(t => t.table_name) || []
        };
        console.log('✅ Table structure test:', results.tableStructure);
      } catch (err) {
        results.tableStructure = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        console.error('❌ Table structure test failed:', err);
      }

      // Test 3: Check leaderboard data
      console.log('Test 3: Checking leaderboard data...');
      try {
        const { data, error } = await supabase
          .from('leaderboard')
          .select('*')
          .limit(5);
        
        results.leaderboardData = {
          success: !error,
          error: error?.message,
          count: data?.length || 0,
          sample: data?.[0] || null
        };
        console.log('✅ Leaderboard data test:', results.leaderboardData);
      } catch (err) {
        results.leaderboardData = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        console.error('❌ Leaderboard data test failed:', err);
      }

      // Test 4: Test leaderboard service
      console.log('Test 4: Testing leaderboard service...');
      try {
        const entries = await leaderboardService.fetchLeaderboardData();
        results.leaderboardService = {
          success: true,
          count: entries.length,
          sample: entries[0] || null
        };
        console.log('✅ Leaderboard service test:', results.leaderboardService);
      } catch (err) {
        results.leaderboardService = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        console.error('❌ Leaderboard service test failed:', err);
      }

      // Test 5: Test Roblox API
      console.log('Test 5: Testing Roblox API...');
      try {
        const testUsername = 'Roblox'; // Use a known username
        const userId = await robloxApi.getRobloxUserId(testUsername);
        const profilePicture = userId ? await robloxApi.getRobloxProfilePicture(userId) : null;
        
        results.robloxApi = {
          success: true,
          testUsername,
          userId,
          profilePicture: profilePicture ? 'Success' : 'Failed'
        };
        console.log('✅ Roblox API test:', results.robloxApi);
      } catch (err) {
        results.robloxApi = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        console.error('❌ Roblox API test failed:', err);
      }

      // Test 6: Check history data
      console.log('Test 6: Checking history data...');
      try {
        const { data, error } = await supabase
          .from('leaderboard_history')
          .select('*')
          .limit(5);
        
        results.historyData = {
          success: !error,
          error: error?.message,
          count: data?.length || 0,
          sample: data?.[0] || null
        };
        console.log('✅ History data test:', results.historyData);
      } catch (err) {
        results.historyData = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        console.error('❌ History data test failed:', err);
      }

      setTestResults(results);
      console.log('🎉 All tests completed!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('💥 Test suite failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        🧪 Leaderboard Data Test Suite
      </h2>
      
      <button
        onClick={runTests}
        disabled={isLoading}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Running Tests...' : 'Run Tests'}
      </button>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {Object.keys(testResults).length > 0 && (
        <div className="space-y-4">
          {Object.entries(testResults).map(([testName, result]: [string, any]) => (
            <div
              key={testName}
              className={`p-4 rounded border ${
                result.success
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              }`}
            >
              <h3 className="font-semibold mb-2 capitalize">
                {testName.replace(/([A-Z])/g, ' $1').trim()}
                {result.success ? ' ✅' : ' ❌'}
              </h3>
              
              {result.error && (
                <p className="text-red-600 dark:text-red-400 mb-2">
                  <strong>Error:</strong> {result.error}
                </p>
              )}
              
              <pre className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
        <h3 className="font-semibold mb-2">🔍 Debug Information</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This test suite checks:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside mt-2">
          <li>Supabase connection and authentication</li>
          <li>Database table structure and permissions</li>
          <li>Leaderboard data availability and format</li>
          <li>Leaderboard service functionality</li>
          <li>Roblox API integration</li>
          <li>History data availability</li>
        </ul>
      </div>
    </div>
  );
}; 