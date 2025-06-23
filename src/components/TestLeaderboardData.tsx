import React, { useEffect, useState } from 'react';
import { leaderboardService } from '../services/leaderboardService';
import { LeaderboardEntry, LeaderboardStats } from '../types/leaderboard';

const TestLeaderboardData: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [gainersData, setGainersData] = useState<LeaderboardStats[]>([]);
  const [losersData, setLosersData] = useState<LeaderboardStats[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testDataFetching = async () => {
      try {
        console.log('=== Testing Leaderboard Data Fetching ===');
        setLoading(true);
        setError(null);

        // Test leaderboard entries
        console.log('1. Testing leaderboard entries...');
        const entries = await leaderboardService.getCurrentLeaderboard();
        setLeaderboardData(entries);
        console.log('✅ Leaderboard entries:', entries.length);

        // Test gainers
        console.log('2. Testing hottest gainers...');
        const gainers = await leaderboardService.getHottestGainers();
        setGainersData(gainers);
        console.log('✅ Hottest gainers:', gainers.length);

        // Test losers
        console.log('3. Testing biggest losers...');
        const losers = await leaderboardService.getBiggestLosers();
        setLosersData(losers);
        console.log('✅ Biggest losers:', losers.length);

        // Test last update time
        console.log('4. Testing last update time...');
        const updateTime = await leaderboardService.getLastUpdateTime();
        setLastUpdate(updateTime);
        console.log('✅ Last update time:', updateTime);

        // Test rank statistics
        console.log('5. Testing rank statistics...');
        const stats = await leaderboardService.getRankStatistics();
        console.log('✅ Rank statistics:', stats.length);

        setLoading(false);
        console.log('=== All tests completed successfully ===');
      } catch (error) {
        console.error('❌ Test failed:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };

    testDataFetching();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Testing Leaderboard Data Fetching...</h2>
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4 text-red-600">Test Failed</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-green-600">✅ Test Results</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-100 p-4 rounded">
          <h3 className="font-semibold">Leaderboard Entries</h3>
          <p className="text-2xl font-bold">{leaderboardData.length}</p>
          {leaderboardData.length > 0 && (
            <div className="text-sm text-gray-600 mt-2">
              Sample: {leaderboardData[0]?.username} - {leaderboardData[0]?.rp} RP
            </div>
          )}
        </div>

        <div className="bg-green-100 p-4 rounded">
          <h3 className="font-semibold">Hottest Gainers</h3>
          <p className="text-2xl font-bold">{gainersData.length}</p>
          {gainersData.length > 0 && (
            <div className="text-sm text-gray-600 mt-2">
              Top: {gainersData[0]?.username} (+{gainersData[0]?.total_gain})
            </div>
          )}
        </div>

        <div className="bg-red-100 p-4 rounded">
          <h3 className="font-semibold">Biggest Losers</h3>
          <p className="text-2xl font-bold">{losersData.length}</p>
          {losersData.length > 0 && (
            <div className="text-sm text-gray-600 mt-2">
              Top: {losersData[0]?.username} ({losersData[0]?.total_loss})
            </div>
          )}
        </div>

        <div className="bg-yellow-100 p-4 rounded">
          <h3 className="font-semibold">Last Update</h3>
          <p className="text-sm">{new Date(lastUpdate).toLocaleString()}</p>
        </div>
      </div>

      {leaderboardData.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Sample Leaderboard Entry:</h3>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(leaderboardData[0], null, 2)}
          </pre>
        </div>
      )}

      {gainersData.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Sample Gainer Entry:</h3>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(gainersData[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TestLeaderboardData; 