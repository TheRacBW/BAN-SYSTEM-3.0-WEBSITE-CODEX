// Test script to check Activity Pulse functionality
const testActivityPulse = async () => {
  try {
    // Test the roblox-status function with a known user
    const response = await fetch('https://your-project.supabase.co/functions/v1/roblox-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_ANON_KEY'
      },
      body: JSON.stringify({
        userIds: [261], // Test with a known user ID
        cookie: 'YOUR_ROBLOX_COOKIE' // Add your Roblox cookie here
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Function response:', data);
      
      // Check if activity pulse data is being populated
      if (data && data.length > 0) {
        console.log('📊 Activity Pulse Data Check:');
        data.forEach(user => {
          console.log(`User ${user.userId}:`, {
            isOnline: user.isOnline,
            isInGame: user.isInGame,
            inBedwars: user.inBedwars,
            // Check if these fields exist in the response
            hasActivityData: user.daily_minutes_today !== undefined
          });
        });
      }
    } else {
      console.error('❌ Function failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('💥 Test error:', error);
  }
};

// Run the test
testActivityPulse(); 