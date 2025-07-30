// Test the Activity Pulse Calculator with sample data
// Run this in your browser console to test the calculator

// Sample data from your database
const sampleStatusData = {
  user_id: "3405581841",
  username: "RealYaweet",
  is_online: true,
  is_in_game: true,
  in_bedwars: true,
  daily_minutes_today: 0,
  weekly_average: "0.00",
  activity_trend: "stable",
  preferred_time_period: "unknown",
  detected_timezone: "unknown",
  last_updated: "2025-07-30 20:31:14.215+00"
};

// Test the calculator
console.log('Testing Activity Pulse Calculator...');
console.log('Sample data:', sampleStatusData);

// Import the calculator (you'll need to adjust this based on your module system)
// For now, let's simulate what the calculator would do:

const calculateActivityPulse = (statusData) => {
  const now = new Date();
  const lastUpdated = new Date(statusData.last_updated);
  const isCurrentlyOnline = statusData.is_online || statusData.is_in_game || statusData.in_bedwars;
  
  // Calculate daily minutes based on current online status
  let dailyMinutesToday = statusData.daily_minutes_today || 0;
  
  if (isCurrentlyOnline) {
    // If currently online, add time since last update (max 30 minutes)
    const minutesSinceUpdate = Math.min(30, Math.max(0, (now.getTime() - lastUpdated.getTime()) / 60000));
    dailyMinutesToday += minutesSinceUpdate;
  }
  
  // Calculate weekly average
  const weeklyAverage = parseFloat(statusData.weekly_average) || 0;
  
  // Determine activity trend
  let activityTrend = 'stable';
  if (dailyMinutesToday > weeklyAverage * 1.2) {
    activityTrend = 'increasing';
  } else if (dailyMinutesToday < weeklyAverage * 0.8) {
    activityTrend = 'decreasing';
  }
  
  // Determine preferred time period based on current hour
  const currentHour = now.getHours();
  const getTimePeriod = (hour) => {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    if (hour >= 22 || hour < 6) return 'night';
    return 'unknown';
  };
  
  const preferredTimePeriod = isCurrentlyOnline ? getTimePeriod(currentHour) : statusData.preferred_time_period || 'unknown';
  
  // Detect timezone based on current activity
  let detectedTimezone = statusData.detected_timezone || 'unknown';
  if (isCurrentlyOnline) {
    if (currentHour >= 14 && currentHour <= 18) detectedTimezone = 'EST (US East)';
    else if (currentHour >= 17 && currentHour <= 21) detectedTimezone = 'PST (US West)';
    else if (currentHour >= 19 && currentHour <= 23) detectedTimezone = 'GMT (UK)';
    else if (currentHour >= 21 || currentHour <= 1) detectedTimezone = 'CET (EU)';
    else if (currentHour >= 0 && currentHour <= 4) detectedTimezone = 'JST (Japan)';
    else if (currentHour >= 6 && currentHour <= 10) detectedTimezone = 'AEST (Australia)';
  }
  
  return {
    dailyMinutesToday,
    weeklyAverage,
    activityTrend,
    preferredTimePeriod,
    detectedTimezone,
    isCurrentlyOnline,
    lastOnlineTimestamp: statusData.last_disconnect_time
  };
};

// Test the calculation
const result = calculateActivityPulse(sampleStatusData);
console.log('Activity Pulse Result:', result);

// Expected output for the online user:
// - dailyMinutesToday should be > 0 (time since last update)
// - activityTrend should be 'increasing' if they're online
// - preferredTimePeriod should be based on current hour
// - detectedTimezone should be detected based on current hour
// - isCurrentlyOnline should be true

console.log('✅ Test completed! Check the result above.'); 