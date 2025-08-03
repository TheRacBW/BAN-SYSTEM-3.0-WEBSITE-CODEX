// Test script to verify the report system database functions
// Run this in your browser console on the /report page to debug issues

async function testReportSystem() {
  console.log('=== Testing Report System ===');
  
  // Test 1: Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  console.log('1. User authenticated:', !!user);
  if (user) {
    console.log('   User ID:', user.id);
  }
  
  // Test 2: Check Discord verification
  if (user) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('discord_verified_at')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.log('2. Discord verification check failed:', error);
      } else {
        console.log('2. Discord verified:', !!data?.discord_verified_at);
        console.log('   Verification timestamp:', data?.discord_verified_at);
      }
    } catch (err) {
      console.log('2. Discord verification error:', err);
    }
  }
  
  // Test 3: Check can_user_submit_reports function
  if (user) {
    try {
      const { data, error } = await supabase.rpc('can_user_submit_reports', {
        user_uuid: user.id
      });
      
      if (error) {
        console.log('3. can_user_submit_reports function error:', error);
      } else {
        console.log('3. can_user_submit_reports result:', data);
      }
    } catch (err) {
      console.log('3. can_user_submit_reports exception:', err);
    }
  }
  
  // Test 4: Check user_report_stats
  if (user) {
    try {
      const { data, error } = await supabase
        .from('user_report_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.log('4. user_report_stats check failed:', error);
      } else {
        console.log('4. user_report_stats:', data);
      }
    } catch (err) {
      console.log('4. user_report_stats error:', err);
    }
  }
  
  // Test 5: Check user_report_restrictions
  if (user) {
    try {
      const { data, error } = await supabase
        .from('user_report_restrictions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.log('5. user_report_restrictions check failed:', error);
      } else {
        console.log('5. user_report_restrictions:', data);
      }
    } catch (err) {
      console.log('5. user_report_restrictions error:', err);
    }
  }
  
  console.log('=== Test Complete ===');
}

// Run the test
testReportSystem(); 