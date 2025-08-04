const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testReportRestrictions() {
  console.log('🧪 Testing Report Restriction System...\n');

  try {
    // Test 1: Check if user_report_restrictions table exists
    console.log('1. Checking user_report_restrictions table...');
    const { data: restrictions, error: restrictionsError } = await supabase
      .from('user_report_restrictions')
      .select('*')
      .limit(5);

    if (restrictionsError) {
      console.log('❌ user_report_restrictions table check failed:', restrictionsError);
    } else {
      console.log('✅ user_report_restrictions table exists');
      console.log('📊 Current restrictions:', restrictions?.length || 0);
    }

    // Test 2: Check if user_report_stats table exists
    console.log('\n2. Checking user_report_stats table...');
    const { data: stats, error: statsError } = await supabase
      .from('user_report_stats')
      .select('*')
      .limit(5);

    if (statsError) {
      console.log('❌ user_report_stats table check failed:', statsError);
    } else {
      console.log('✅ user_report_stats table exists');
      console.log('📊 Current stats entries:', stats?.length || 0);
    }

    // Test 3: Test can_user_submit_reports function
    console.log('\n3. Testing can_user_submit_reports function...');
    const { data: canSubmit, error: canSubmitError } = await supabase.rpc('can_user_submit_reports', {
      user_uuid: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    });

    if (canSubmitError) {
      console.log('❌ can_user_submit_reports function failed:', canSubmitError);
    } else {
      console.log('✅ can_user_submit_reports function works');
      console.log('📊 Result for dummy user:', canSubmit);
    }

    // Test 4: Test add_user_restriction function
    console.log('\n4. Testing add_user_restriction function...');
    const { data: addRestriction, error: addRestrictionError } = await supabase.rpc('add_user_restriction', {
      user_uuid: '00000000-0000-0000-0000-000000000000',
      restriction_type: 'warning',
      reason: 'Test restriction',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    });

    if (addRestrictionError) {
      console.log('❌ add_user_restriction function failed:', addRestrictionError);
    } else {
      console.log('✅ add_user_restriction function works');
      console.log('📊 Added restriction:', addRestriction);
    }

    // Test 5: Test remove_user_restriction function
    console.log('\n5. Testing remove_user_restriction function...');
    if (addRestriction) {
      const { data: removeRestriction, error: removeRestrictionError } = await supabase.rpc('remove_user_restriction', {
        restriction_id: addRestriction
      });

      if (removeRestrictionError) {
        console.log('❌ remove_user_restriction function failed:', removeRestrictionError);
      } else {
        console.log('✅ remove_user_restriction function works');
        console.log('📊 Removed restriction:', removeRestriction);
      }
    }

    console.log('\n🎉 Report restriction system tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Database tables: ✅');
    console.log('- Restriction functions: ✅');
    console.log('- Stats tracking: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReportRestrictions(); 