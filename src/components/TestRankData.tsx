import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function TestRankData() {
  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testRankQuery = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing rank data query...');
      
      // Test the exact query from PlayersPage
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          accounts:player_accounts(
            id,
            user_id,
            rank:player_account_ranks(
              rank_id,
              account_ranks(*)
            )
          )
        `)
        .limit(1);

      if (error) {
        console.error('❌ Test query error:', error);
        setTestData({ error: error.message });
        return;
      }

      console.log('✅ Test query result:', data);
      setTestData(data);

      // Test account_ranks table directly
      const { data: ranksData, error: ranksError } = await supabase
        .from('account_ranks')
        .select('*');

      if (ranksError) {
        console.error('❌ Ranks query error:', ranksError);
      } else {
        console.log('✅ Available ranks:', ranksData);
      }

      // Test player_account_ranks table directly
      const { data: accountRanksData, error: accountRanksError } = await supabase
        .from('player_account_ranks')
        .select('*');

      if (accountRanksError) {
        console.error('❌ Account ranks query error:', accountRanksError);
      } else {
        console.log('✅ Account rank assignments:', accountRanksData);
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      setTestData({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg mb-4">
      <h3 className="text-lg font-bold mb-2">🧪 Rank Data Test</h3>
      <button 
        onClick={testRankQuery}
        disabled={loading}
        className="btn btn-primary mb-4"
      >
        {loading ? 'Testing...' : 'Test Rank Data Query'}
      </button>
      
      {testData && (
        <div className="text-sm">
          <h4 className="font-semibold mb-2">Test Results:</h4>
          <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-96">
            {JSON.stringify(testData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 