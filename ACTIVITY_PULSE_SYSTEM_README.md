# Activity Pulse System - Comprehensive Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Data Flow & Architecture](#data-flow--architecture)
4. [Features & Goals](#features--goals)
5. [UI/UX Restrictions](#uiux-restrictions)
6. [Technical Implementation](#technical-implementation)
7. [Data Calculations](#data-calculations)
8. [Supabase Interactions](#supabase-interactions)
9. [Current Issues & Debugging](#current-issues--debugging)
10. [Future Enhancements](#future-enhancements)
11. [Maintenance & Monitoring](#maintenance--monitoring)

---

## 🎯 System Overview

The Activity Pulse system is a comprehensive player engagement tracking system for the Roblox BedWars player tracking website. It provides real-time activity insights, historical patterns, and meaningful engagement metrics for players across multiple Roblox accounts.

### **Core Purpose**
- Track meaningful player activity (In BedWars, In Game) across multiple accounts
- Provide activity level indicators and trend analysis
- Show last seen information with account context
- Display peak activity times and preferred playing periods
- Aggregate data across multiple accounts per player

### **Key Principles**
- **Meaningful Activity Only**: Only count "In BedWars" and "In Game" status, not just "online"
- **Multi-Account Aggregation**: Combine data from all player accounts
- **Real-Time Updates**: Frontend-triggered database updates
- **Rate Limiting**: Prevent data explosion and excessive logging
- **Offline User Support**: Show last seen information for offline users

---

## 🗄️ Database Schema

### **Primary Tables**

#### **1. `roblox_user_status`**
**Purpose**: Basic online status and session tracking
```sql
-- Core status columns
user_id INTEGER PRIMARY KEY,
is_online BOOLEAN DEFAULT FALSE,
is_in_game BOOLEAN DEFAULT FALSE,
in_bedwars BOOLEAN DEFAULT FALSE,
last_updated TIMESTAMP WITH TIME ZONE,
username TEXT,

-- Session tracking
session_start_time TIMESTAMP WITH TIME ZONE,
last_disconnect_time TIMESTAMP WITH TIME ZONE,

-- Activity Pulse columns (legacy - now primarily in player_activity_summary)
daily_minutes_today INTEGER DEFAULT 0,
daily_minutes_yesterday INTEGER DEFAULT 0,
weekly_total_minutes INTEGER DEFAULT 0,
weekly_average DECIMAL(5,2) DEFAULT 0,
activity_trend TEXT DEFAULT 'stable',
preferred_time_period TEXT DEFAULT 'unknown',
last_reset_date DATE DEFAULT CURRENT_DATE,

-- Timezone analysis (legacy)
detected_timezone TEXT DEFAULT 'unknown',
peak_hours_start INTEGER DEFAULT NULL,
peak_hours_end INTEGER DEFAULT NULL,
activity_distribution JSONB DEFAULT '{}'
```

#### **2. `roblox_presence_logs`**
**Purpose**: Detailed, rate-limited presence logging
```sql
id SERIAL PRIMARY KEY,
roblox_user_id INTEGER NOT NULL REFERENCES roblox_user_status(user_id),
session_id UUID,
was_online BOOLEAN NOT NULL,
was_in_game BOOLEAN DEFAULT FALSE,
in_bedwars BOOLEAN DEFAULT FALSE,
place_id INTEGER,
universe_id INTEGER,
status_change_type TEXT CHECK (status_change_type IN ('session_start', 'session_end', 'status_change', 'status_check')),
session_duration_minutes INTEGER,
detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

#### **3. `player_activity_summary`**
**Purpose**: Aggregated activity data for display
```sql
id BIGSERIAL PRIMARY KEY,
user_id INTEGER UNIQUE NOT NULL,
daily_minutes_today INTEGER DEFAULT 0,
weekly_average DECIMAL(5,2) DEFAULT 0,
activity_trend TEXT DEFAULT 'stable',
preferred_time_period TEXT DEFAULT 'unknown',
current_session_minutes INTEGER DEFAULT 0,
is_online BOOLEAN DEFAULT FALSE,
last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

#### **4. `user_sessions`**
**Purpose**: Individual session tracking
```sql
session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id INTEGER NOT NULL REFERENCES roblox_user_status(user_id),
session_start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
session_end_time TIMESTAMP WITH TIME ZONE,
is_in_game BOOLEAN DEFAULT FALSE,
in_bedwars BOOLEAN DEFAULT FALSE,
place_id INTEGER,
universe_id INTEGER,
last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Supporting Tables**

#### **5. `player_accounts`**
**Purpose**: Player account relationships
```sql
id UUID PRIMARY KEY,
player_id UUID REFERENCES players(id),
user_id INTEGER NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

#### **6. `player_tracking_refresh`**
**Purpose**: Coordination for status updates
```sql
id INTEGER PRIMARY KEY DEFAULT 1,
status TEXT DEFAULT 'complete',
last_refresh_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
triggered_by UUID
```

---

## 🔄 Data Flow & Architecture

### **Frontend-Triggered Database Tracking**

#### **1. Status Detection Flow**
```
User views player card → Frontend detects status → Rate limiting check → Database update
```

#### **2. Data Sources**
- **Primary**: `roblox_presence_logs` (historical last seen)
- **Secondary**: `player_activity_summary` (aggregated activity)
- **Fallback**: `roblox_user_status` (current status)

#### **3. Rate Limiting Strategy**
- **Frontend**: 5-minute rate limit per user
- **Database**: Only log status changes or 10-minute heartbeats
- **Cleanup**: Aggressive cleanup of old logs (7-30 days)

### **Data Flow Diagram**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Supabase       │    │   Database      │
│   (React)       │    │   (Edge Func)    │    │   (PostgreSQL)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. View player card  │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │ 2. Get current status│                       │
         │◀──────────────────────│                       │
         │                       │                       │
         │ 3. Track status      │                       │
         │──────────────────────▶│                       │
         │                       │ 4. smart_track_      │
         │                       │    presence_session  │
         │                       │──────────────────────▶│
         │                       │                       │
         │                       │ 5. Update logs       │
         │                       │◀──────────────────────│
         │                       │                       │
         │ 6. Get activity data │                       │
         │──────────────────────▶│                       │
         │                       │ 7. Query summary      │
         │                       │◀──────────────────────│
         │                       │                       │
         │ 8. Get last seen     │                       │
         │──────────────────────▶│                       │
         │                       │ 9. Query logs         │
         │                       │◀──────────────────────│
         │                       │                       │
         │ 10. Display UI       │                       │
         │◀──────────────────────│                       │
```

---

## 🎯 Features & Goals

### **Current Features**

#### **1. Activity Level Indicators**
- **🔥 Very Active**: 120+ minutes/day
- **⚡ Active**: 45-120 minutes/day  
- **💧 Light Activity**: 10-45 minutes/day
- **😴 Inactive**: <10 minutes/day

#### **2. Trend Analysis**
- **📈 Trending up**: Increasing activity
- **📉 Trending down**: Decreasing activity
- **➖ Stable**: Consistent activity

#### **3. Time Period Analysis**
- **🕒 Morning**: 6AM-12PM
- **🕒 Afternoon**: 12PM-6PM
- **🕒 Evening**: 6PM-12AM
- **🕒 Night**: 12AM-6AM

#### **4. Last Seen Information**
- **Account Context**: Shows which account was last active
- **Activity Context**: Shows what they were doing (In BedWars, In Game)
- **Time Context**: Shows when they were last seen
- **Meaningful Only**: Only shows for offline users with meaningful activity

#### **5. Multi-Account Aggregation**
- **Combined Metrics**: Aggregates daily minutes across all accounts
- **Average Calculations**: Calculates average weekly activity
- **Trend Detection**: Determines overall trend across accounts
- **Online Status**: Shows if any account is currently online

### **Goals**

#### **Primary Goals**
1. **Provide meaningful activity insights** for player engagement
2. **Show historical patterns** to understand player behavior
3. **Display last seen information** for offline users
4. **Aggregate multi-account data** seamlessly
5. **Prevent data explosion** through smart rate limiting

#### **Secondary Goals**
1. **Timezone detection** from activity patterns (infrastructure exists but not currently displayed)
2. **Peak hours analysis** for optimal playing times (infrastructure exists but not currently displayed)
3. **Session tracking** for detailed engagement metrics
4. **Admin monitoring** of system health and performance

---

## 🎨 UI/UX Restrictions

### **Display Locations**

#### **1. Player Cards (Compact View)**
- **Location**: `src/components/PlayerCard.tsx` - CompactActivityPulse
- **Restrictions**: 
  - Single line display only
  - Must fit within existing card layout
  - No modal popups or overlays
  - Consistent with existing card styling

#### **2. Player Modal (Full View)**
- **Location**: `src/components/PlayerCard.tsx` - ActivityPulse component
- **Restrictions**:
  - Must fit within existing modal layout
  - No additional modals or overlays
  - Consistent with existing modal styling
  - Responsive design for mobile/desktop

#### **3. Admin Dashboard**
- **Location**: `src/pages/AdminPage.tsx` - ActivityPulseManager
- **Restrictions**:
  - Admin-only access
  - Must fit within existing admin layout
  - No impact on regular user experience

### **Styling Requirements**

#### **1. Theme Consistency**
- **Light Mode**: Use existing light theme colors
- **Dark Mode**: Use existing dark theme colors
- **No Custom Colors**: Use Tailwind CSS classes only
- **Consistent Spacing**: Match existing component spacing

#### **2. Responsive Design**
- **Mobile**: Compact display, minimal information
- **Tablet**: Balanced information display
- **Desktop**: Full information display
- **No Horizontal Scrolling**: Must fit within container

#### **3. Performance Requirements**
- **No Blocking Operations**: All operations must be async
- **Efficient Rendering**: Use React.memo and useMemo where appropriate
- **Minimal Re-renders**: Optimize component updates
- **Graceful Loading**: Show loading states for async operations

### **Content Restrictions**

#### **1. Information Density**
- **Player Cards**: Maximum 3-4 pieces of information
- **Player Modal**: Full information display
- **No Information Overload**: Prioritize most important data

#### **2. Text Length**
- **Activity Level**: Maximum 15 characters
- **Trend Indicator**: Maximum 10 characters
- **Last Seen**: Maximum 50 characters
- **Time Period**: Maximum 20 characters

#### **3. Icon Usage**
- **Consistent Icons**: Use Lucide React icons only
- **Meaningful Icons**: Each icon must have clear meaning
- **Accessibility**: Include alt text for screen readers

---

## ⚙️ Technical Implementation

### **Core Components**

#### **1. ActivityPulse Component**
**Location**: `src/components/ActivityPulse.tsx`
```typescript
interface ActivityPulseProps {
  dailyMinutesToday: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: string;
  lastOnlineTimestamp?: string;
  isCurrentlyOnline: boolean;
  compact?: boolean;
  detectedTimezone?: string; // Available but not currently used
  peakHoursStart?: number;
  peakHoursEnd?: number;
  lastSeenAccount?: string;
  lastSeenStatus?: string;
}
```

**Features**:
- Compact and full view modes
- Activity level calculation
- Trend visualization
- Last seen formatting
- Responsive design

#### **2. FrontendActivityTracker Service**
**Location**: `src/services/activityTracker.ts`
```typescript
class FrontendActivityTracker {
  static async trackStatusChange(userId: string, currentStatus: UserStatus)
  static async getActivityData(userId: string): Promise<ActivityData | null>
  static async getLastSeenInfo(userId: string, username?: string)
  static async refreshActivitySummary(userId: string)
  static cleanupRateLimiting()
}
```

**Features**:
- Rate limiting (5-minute intervals)
- Status change detection
- Database interaction
- Error handling

#### **3. PlayerCard Integration**
**Location**: `src/components/PlayerCard.tsx`
```typescript
// Compact view for player cards
<CompactActivityPulse accounts={playerData.accounts} />

// Full view for player modal
<ActivityPulse
  dailyMinutesToday={aggregatedData.dailyMinutesToday}
  weeklyAverage={aggregatedData.weeklyAverage}
  // ... other props
/>
```

### **Data Aggregation Logic**

#### **1. Multi-Account Aggregation**
```typescript
const aggregatePlayerActivity = (playerAccounts: PlayerAccount[]) => {
  // Sum daily minutes across all accounts
  const totalDailyMinutes = playerAccounts.reduce((sum, acc) => 
    sum + (acc.status?.dailyMinutesToday || 0), 0);
  
  // Average weekly activity across accounts
  const avgWeeklyAverage = playerAccounts.reduce((sum, acc) => 
    sum + (acc.status?.weeklyAverage || 0), 0) / playerAccounts.length;
  
  // Determine overall trend
  const activityTrend = determineOverallTrend(playerAccounts);
  
  // Check if any account is online
  const isCurrentlyOnline = playerAccounts.some(acc => 
    acc.status?.isOnline || acc.status?.isInGame || acc.status?.inBedwars);
  
  return {
    dailyMinutesToday: totalDailyMinutes,
    weeklyAverage: avgWeeklyAverage,
    activityTrend,
    isCurrentlyOnline
  };
};
```

#### **2. Activity Level Calculation**
```typescript
const getActivityLevel = (dailyMinutes: number, weeklyAvg: number, isCurrentlyOnline: boolean) => {
  // Online users can't be "Inactive"
  if (isCurrentlyOnline) {
    if (dailyMinutes >= 120) return { level: 'high', label: 'Very Active', icon: '🔥' };
    if (dailyMinutes >= 45) return { level: 'medium', label: 'Active', icon: '⚡' };
    return { level: 'active_online', label: 'Active', icon: '💧' };
  }
  
  // Offline users use historical data
  if (dailyMinutes >= 120) return { level: 'high', label: 'Very Active', icon: '🔥' };
  if (dailyMinutes >= 45) return { level: 'medium', label: 'Active', icon: '⚡' };
  if (dailyMinutes >= 10) return { level: 'low', label: 'Light Activity', icon: '💧' };
  return { level: 'inactive', label: 'Inactive', icon: '😴' };
};
```

---

## 📊 Data Calculations

### **Activity Metrics**

#### **1. Daily Minutes Calculation**
```typescript
// From current session + accumulated daily minutes
const dailyMinutesToday = currentSessionMinutes + accumulatedDailyMinutes;

// Current session calculation
const currentSessionMinutes = Math.min(30, Math.max(0, 
  (now.getTime() - sessionStartTime.getTime()) / 60000));
```

#### **2. Weekly Average Calculation**
```typescript
// Simple 7-day rolling average
const weeklyAverage = (dailyMinutesToday + yesterdayMinutes) * 3.5 / 7;

// More sophisticated calculation with actual daily history
const weeklyAverage = dailyHistory.reduce((sum, day) => sum + day.minutes, 0) / 7;
```

#### **3. Trend Analysis**
```typescript
const determineTrend = (currentAverage: number, previousAverage: number) => {
  if (currentAverage > previousAverage * 1.2) return 'increasing';
  if (currentAverage < previousAverage * 0.8) return 'decreasing';
  return 'stable';
};
```

#### **4. Time Period Detection**
```typescript
const getTimePeriod = (hour: number): string => {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};
```

### **Last Seen Calculations**

#### **1. Meaningful Activity Detection**
```typescript
// Only count meaningful activity (not just "online")
if (data.in_bedwars) {
  lastSeenStatus = 'in_bedwars';
  lastSeenActivity = 'In BedWars';
} else if (data.was_in_game) {
  lastSeenStatus = 'in_game';
  lastSeenActivity = 'In Game';
}
// Don't count just "online" as it could be someone leaving the website open
```

#### **2. Time Ago Formatting**
```typescript
const formatLastSeen = (timestamp: string): string => {
  const now = new Date();
  const lastSeen = new Date(timestamp);
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
};
```

---

## 🔌 Supabase Interactions

### **Database Functions**

#### **1. `smart_track_presence_session`**
**Purpose**: Rate-limited presence tracking
```sql
CREATE OR REPLACE FUNCTION smart_track_presence_session(
  user_id_param INTEGER,
  is_online_param BOOLEAN,
  is_in_game_param BOOLEAN,
  in_bedwars_param BOOLEAN,
  place_id_param INTEGER,
  universe_id_param INTEGER
) RETURNS JSON
```

**Logic**:
- Check for recent logs (rate limiting)
- Only log if status changed or heartbeat needed
- Update `roblox_user_status` table
- Insert into `roblox_presence_logs`

#### **2. `update_activity_summary`**
**Purpose**: Update aggregated activity data
```sql
CREATE OR REPLACE FUNCTION update_activity_summary(
  user_id_param INTEGER
) RETURNS VOID
```

**Logic**:
- Calculate daily minutes from sessions
- Update weekly averages
- Determine activity trends
- Update `player_activity_summary` table

#### **3. `comprehensive_presence_cleanup`**
**Purpose**: Clean up old presence logs
```sql
CREATE OR REPLACE FUNCTION comprehensive_presence_cleanup() 
RETURNS JSON
```

**Logic**:
- Delete old status check logs (7 days)
- Delete old presence logs (30 days)
- Consolidate duplicate logs
- Return cleanup statistics

### **Edge Functions**

#### **1. `roblox-status`**
**Purpose**: Fetch current Roblox status
```typescript
// Fetches current online status from Roblox API
// Updates basic status in roblox_user_status table
// Does NOT calculate activity pulse metrics
```

**Data Flow**:
1. Fetch status from Roblox API
2. Update `roblox_user_status` table
3. Return status to frontend
4. Frontend triggers activity tracking

### **Scheduled Jobs**

#### **1. Daily Reset**
```sql
-- Reset daily metrics at midnight
SELECT cron.schedule('reset-daily-activity', '0 0 * * *', 
  'SELECT reset_daily_activity_data();');
```

#### **2. Weekly Cleanup**
```sql
-- Clean up old data weekly
SELECT cron.schedule('cleanup-activity-data', '0 2 * * 0', 
  'SELECT cleanup_activity_data();');
```

---

## 🐛 Current Issues & Debugging

### **Known Issues**

#### **1. Last Seen Not Appearing**
**Problem**: Users with activity data don't show "Last seen" information
**Status**: This issue has been addressed with improved data flow and filtering logic
**Debugging**: Can add comprehensive logging to track data flow if needed
```typescript
// Debug logs can be added to:
// - getLastSeenInfo() in activityTracker.ts
// - fetchAccountStatuses() in PlayersPage.tsx
// - formatLastSeenWithAccount() in ActivityPulse.tsx
```

**Potential Causes**:
- No presence logs exist for user
- Only "online" status exists (filtered out as non-meaningful)
- Data flow interruption
- Type mismatches

#### **2. Rate Limiting Issues**
**Problem**: Some status changes not being tracked
**Solution**: Implemented frontend and database rate limiting
```typescript
// Frontend rate limiting: 5 minutes per user
// Database rate limiting: Only log changes or heartbeats
```

#### **3. Data Explosion**
**Problem**: Excessive logging causing high egress costs
**Solution**: Implemented smart logging and aggressive cleanup
```sql
-- Clean up old logs automatically
-- Rate limit status checks
-- Consolidate duplicate entries
```

### **Debugging Tools**

#### **1. Console Logging**
```typescript
// Debug logs can be added temporarily for troubleshooting
console.log(`🔍 getLastSeenInfo: Looking for user ${userId}`);
console.log(`✅ getLastSeenInfo: Found meaningful activity`);
console.log(`❌ getLastSeenInfo: No data found`);
```

#### **2. Database Monitoring**
```sql
-- Check presence logs for user
SELECT * FROM roblox_presence_logs 
WHERE roblox_user_id = ? 
ORDER BY detected_at DESC LIMIT 5;

-- Check activity summary
SELECT * FROM player_activity_summary 
WHERE user_id = ?;
```

#### **3. System Health Monitoring**
```sql
-- Check system health
SELECT * FROM activity_pulse_health;
```

---

## 🚀 Future Enhancements

### **Short-term Improvements**

#### **1. Enhanced Last Seen**
- **Timezone-aware timestamps**: Show times in user's timezone
- **Activity context**: Show specific game/place information
- **Session duration**: Show how long they were active
- **Account switching**: Track when users switch between accounts

#### **2. Improved Activity Metrics**
- **Session quality**: Distinguish between active and passive sessions
- **Engagement scoring**: Calculate engagement based on activity patterns
- **Predictive analytics**: Predict when users will be online
- **Activity streaks**: Track consecutive days of activity

#### **3. Better UI/UX**
- **Activity charts**: Visual representation of activity over time
- **Interactive elements**: Click to see detailed activity history
- **Real-time updates**: Live activity indicators
- **Mobile optimization**: Better mobile experience

### **Medium-term Features**

#### **1. Advanced Analytics**
- **Player clustering**: Group similar players by activity patterns
- **Activity correlation**: Find correlations between different activities
- **Seasonal patterns**: Detect seasonal activity changes
- **Social features**: Show friends' activity status

#### **2. Performance Optimizations**
- **Caching layer**: Cache frequently accessed data
- **Database optimization**: Optimize queries and indexes
- **CDN integration**: Serve static assets from CDN
- **Background processing**: Move heavy calculations to background jobs

#### **3. Admin Features**
- **Activity dashboard**: Comprehensive admin dashboard
- **System monitoring**: Real-time system health monitoring
- **Data export**: Export activity data for analysis
- **Configuration management**: Admin-configurable settings

### **Long-term Vision**

#### **1. Machine Learning Integration**
- **Activity prediction**: Predict when users will be online
- **Engagement optimization**: Suggest optimal playing times
- **Anomaly detection**: Detect unusual activity patterns
- **Personalization**: Personalized activity insights

#### **2. Advanced Social Features**
- **Team activity**: Show team activity patterns
- **Activity challenges**: Activity-based challenges and rewards
- **Social leaderboards**: Activity-based leaderboards
- **Activity sharing**: Share activity achievements

#### **3. Platform Expansion**
- **Multi-game support**: Support for other Roblox games
- **Cross-platform**: Support for other gaming platforms
- **API access**: Public API for third-party integrations
- **Mobile app**: Native mobile application

---

## 🔧 Maintenance & Monitoring

### **Regular Maintenance Tasks**

#### **1. Daily Tasks**
```sql
-- Reset daily metrics
SELECT reset_daily_activity_data();

-- Clean up old rate limiting data
SELECT cleanup_old_rate_limiting();
```

#### **2. Weekly Tasks**
```sql
-- Clean up old activity data
SELECT cleanup_activity_data();

-- Comprehensive presence cleanup
SELECT comprehensive_presence_cleanup();
```

#### **3. Monthly Tasks**
```sql
-- Analyze system performance
SELECT get_system_performance_metrics();

-- Optimize database indexes
-- Review and update rate limiting settings
```

### **Monitoring Dashboard**

#### **1. System Health Metrics**
- **Database size**: Monitor table growth
- **Query performance**: Track slow queries
- **Error rates**: Monitor function failures
- **Rate limiting**: Track rate limit hits

#### **2. Activity Metrics**
- **Active users**: Number of users with recent activity
- **Data accuracy**: Validate activity calculations
- **Last seen accuracy**: Verify last seen information
- **Multi-account usage**: Track users with multiple accounts

#### **3. Performance Metrics**
- **Response times**: API response times
- **Database connections**: Connection pool usage
- **Memory usage**: Frontend memory consumption
- **Error tracking**: JavaScript errors and exceptions

### **Alerting System**

#### **1. Critical Alerts**
- **Database errors**: Function failures
- **High error rates**: Elevated error percentages
- **Performance degradation**: Slow response times
- **Data inconsistencies**: Invalid activity data

#### **2. Warning Alerts**
- **High egress costs**: Excessive data transfer
- **Rate limiting**: Frequent rate limit hits
- **Storage growth**: Rapid table growth
- **User complaints**: Activity display issues

### **Backup & Recovery**

#### **1. Data Backup**
```sql
-- Backup critical tables
pg_dump -t roblox_presence_logs -t player_activity_summary database_name

-- Backup configuration
pg_dump -t activity_pulse_config database_name
```

#### **2. Recovery Procedures**
- **Data restoration**: Restore from backups
- **Function recovery**: Redeploy database functions
- **Configuration recovery**: Restore settings
- **Rollback procedures**: Revert to previous versions

---

## 📚 Additional Resources

### **Related Documentation**
- [Database Migration Guide](./MIGRATION_SYSTEM_README.md)
- [Admin Interface Guide](./ADMIN_README.md)
- [API Documentation](./API_README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_README.md)

### **Code References**
- **Frontend Components**: `src/components/ActivityPulse.tsx`
- **Services**: `src/services/activityTracker.ts`
- **Database Functions**: `supabase/migrations/`
- **Types**: `src/types/players.ts`

### **Configuration Files**
- **Database Schema**: `supabase/migrations/20250110000000_fix_activity_tracking_data_explosion.sql`
- **TypeScript Types**: `src/types/players.ts`
- **Component Props**: `src/components/ActivityPulse.tsx`

---

## 🎯 Summary

The Activity Pulse system is a comprehensive player engagement tracking solution that provides meaningful insights into player activity patterns. It balances data accuracy with performance, implements smart rate limiting to prevent data explosion, and provides both compact and detailed views for different UI contexts.

The system is designed to be maintainable, scalable, and user-friendly while respecting existing UI/UX constraints and providing valuable insights for both players and administrators.

### **Current Implementation Status**

#### **✅ Fully Implemented**
- Activity level indicators (Very Active, Active, Light Activity, Inactive)
- Trend analysis (increasing, decreasing, stable)
- Time period analysis (morning, afternoon, evening, night)
- Last seen information with account context
- Multi-account data aggregation
- Rate-limited data collection
- Responsive UI components
- Admin monitoring capabilities

#### **🔄 Partially Implemented**
- **Timezone detection**: Infrastructure exists in database and calculations, but not displayed in UI
- **Peak hours analysis**: Infrastructure exists but not currently shown to users
- **Session tracking**: Basic session tracking implemented, detailed analytics available

#### **📋 Future Enhancements**
- Enhanced last seen with timezone awareness
- Activity charts and visualizations
- Real-time updates and live indicators
- Advanced analytics and machine learning integration

**Key Success Metrics**:
- ✅ Meaningful activity tracking (In BedWars, In Game only)
- ✅ Multi-account data aggregation
- ✅ Last seen information for offline users
- ✅ Rate-limited data collection
- ✅ Responsive UI components
- ✅ Admin monitoring capabilities

**Future Focus Areas**:
- 🔄 Enhanced debugging and monitoring
- 🔄 Performance optimizations
- 🔄 Advanced analytics features
- 🔄 Machine learning integration
- 🔄 Social features and gamification 