# Website Time Tracking System

## Overview

The website time tracking system automatically tracks user activity across the entire website and awards coins based on time spent. The system is designed to be efficient with minimal database egress while providing comprehensive tracking and reward mechanisms.

## Key Features

### 🕒 **Website-Wide Time Tracking**
- Tracks time spent on the entire website, not just specific pages
- Monitors user activity through page visibility, focus, and blur events
- Updates activity every 5 minutes to minimize database calls

### 🪙 **Automatic Coin Rewards**
- **30 coins awarded every 30 minutes** of active time
- Rewards are calculated and distributed automatically
- Coins are earned from time spent, not from specific actions

### 👥 **Admin Management**
- View detailed time and coin statistics for all users
- Force update coin calculations for individual users
- Monitor active sessions and user activity

### ⚡ **Egress Optimization**
- Activity updates every 5 minutes instead of real-time
- Database functions handle complex calculations server-side
- Efficient session management with automatic cleanup

## Database Schema

### Enhanced Tables

#### `user_session_time`
```sql
-- New columns added for better tracking
ALTER TABLE user_session_time ADD COLUMN total_time_seconds integer DEFAULT 0;
ALTER TABLE user_session_time ADD COLUMN last_activity timestamp with time zone DEFAULT now();
ALTER TABLE user_session_time ADD COLUMN is_active boolean DEFAULT true;
```

#### `user_coins`
```sql
-- New columns for time-based tracking
ALTER TABLE user_coins ADD COLUMN total_time_spent_seconds integer DEFAULT 0;
ALTER TABLE user_coins ADD COLUMN coins_from_time integer DEFAULT 0;
ALTER TABLE user_coins ADD COLUMN last_time_reward timestamp with time zone;
```

### Database Functions

#### `calculate_time_coins(time_seconds integer)`
Calculates coin rewards based on time spent:
- 30 coins every 30 minutes (1800 seconds)
- Returns integer value of coins earned

#### `update_user_coins_from_time(user_uuid uuid)`
Updates user coins based on total time spent:
- Calculates total time from all sessions
- Awards coins based on time calculation
- Updates user coin balance

#### `get_user_time_stats(user_uuid uuid)`
Returns comprehensive time and coin statistics:
- Total time spent in seconds
- Total coins and coins from time
- Last activity timestamp
- Number of active sessions

#### `start_user_session(user_uuid uuid)`
Starts a new session for a user:
- Ends any existing active sessions
- Creates new session with current timestamp
- Returns session ID

#### `end_user_session(session_uuid uuid)`
Ends a session and awards coins:
- Calculates session duration
- Awards coins based on time spent
- Updates session with end time and coins earned

## Frontend Implementation

### TimeTrackingService
Located at `src/services/timeTrackingService.ts`

**Key Methods:**
- `startTracking(userId: string)` - Start time tracking for user
- `endCurrentSession()` - End current session and award coins
- `updateActivity()` - Update user activity (called every 5 minutes)
- `getUserTimeStats(userId: string)` - Get user time statistics
- `forceUpdateUserCoins(userId: string)` - Force update coins (admin)

**Activity Monitoring:**
- Page visibility changes (document.hidden)
- Window focus/blur events
- Beforeunload event for session cleanup
- Periodic activity updates every 5 minutes

### useTimeTracking Hook
Located at `src/hooks/useTimeTracking.ts`

**Features:**
- Automatic session management
- Periodic stats refresh
- Cleanup on component unmount
- Error handling and logging

### TimeTrackingProvider
Located at `src/components/TimeTrackingProvider.tsx`

**Features:**
- Global time tracking initialization
- Visual indicator when tracking is active
- Automatic start/stop based on user authentication

## Admin Interface

### User Management Integration
The `UserPrivilegeEditor` component now includes a comprehensive "Time & Coin Statistics" section:

**Displayed Information:**
- Total time spent (formatted as hours/minutes/seconds)
- Total coins and coins earned from time
- Active sessions count
- Last activity timestamp
- Reward system explanation

**Admin Actions:**
- Refresh statistics button
- Force update coins button
- Real-time data loading

### Visual Indicators
- Loading states with spinners
- Color-coded statistics (green for active sessions)
- Formatted time durations
- Coin amounts with thousands separators

## Reward System

### Coin Calculation
```javascript
// 30 coins every 30 minutes (1800 seconds)
const coinsEarned = Math.floor(seconds / 1800) * 30;
```

### Time Tracking Rules
1. **Website-wide tracking** - Not limited to specific pages
2. **Activity-based** - Tracks when user is actively using the site
3. **Automatic rewards** - No manual intervention required
4. **Efficient updates** - Activity updates every 5 minutes
5. **Session management** - Automatic session start/end

### Session Lifecycle
1. **Session Start**: When user visits the website
2. **Activity Updates**: Every 5 minutes while active
3. **Session End**: When user leaves or closes the page
4. **Coin Award**: Calculated and awarded automatically

## Egress Optimization

### Database Efficiency
- **Activity updates**: Every 5 minutes instead of real-time
- **Server-side calculations**: Complex logic handled in database functions
- **Batch operations**: Multiple updates handled efficiently
- **Indexed queries**: Fast retrieval of user statistics

### Client-Side Optimization
- **Event-based updates**: Only update on actual activity
- **Debounced calls**: Prevent excessive API calls
- **Cleanup handlers**: Proper session termination
- **Error handling**: Graceful failure recovery

## Usage Examples

### Starting Time Tracking
```javascript
import { useTimeTracking } from '../hooks/useTimeTracking';

const { startTracking, timeStats } = useTimeTracking();

// Automatically starts when user is authenticated
```

### Getting User Statistics
```javascript
import { TimeTrackingService } from '../services/timeTrackingService';

const stats = await TimeTrackingService.getUserTimeStats(userId);
console.log(`User spent ${TimeTrackingService.formatDuration(stats.total_time_seconds)}`);
console.log(`Earned ${stats.coins_from_time} coins from time`);
```

### Admin Force Update
```javascript
// Force update coins for a user
await TimeTrackingService.forceUpdateUserCoins(userId);
```

## Migration Instructions

### 1. Run Database Migration
```sql
-- Execute the migration file
-- supabase/migrations/20250115000001_enhance_time_tracking.sql
```

### 2. Update Frontend
The new components are automatically integrated:
- `TimeTrackingProvider` wraps the app
- `useTimeTracking` hook available for components
- `TimeTrackingService` for direct API calls

### 3. Admin Interface
The `UserPrivilegeEditor` automatically includes the new time tracking section.

## Monitoring and Maintenance

### Database Monitoring
- Monitor `user_session_time` table for active sessions
- Check `user_coins` table for coin distribution
- Review function performance with database logs

### Performance Considerations
- Session cleanup happens automatically
- Inactive sessions are marked as inactive
- Database functions handle heavy calculations

### Troubleshooting
- **No coins awarded**: Check if sessions are being created properly
- **High egress**: Verify activity update intervals
- **Missing stats**: Ensure user has valid session records

## Future Enhancements

### Potential Improvements
1. **Real-time notifications** when coins are awarded
2. **Time-based achievements** and milestones
3. **Detailed session analytics** for admins
4. **Custom reward rates** based on user tiers
5. **Offline time tracking** with sync on reconnection

### Scalability Considerations
- Database functions handle server-side calculations
- Efficient indexing for large user bases
- Batch processing for coin updates
- Cleanup procedures for old session data

## Security Considerations

### Data Protection
- User session data is protected by RLS policies
- Admin functions require proper authentication
- Session IDs are UUID-based for security

### Privacy Compliance
- Only tracks time spent, not specific page content
- Session data can be deleted on user request
- No personal information stored in session records

---

This system provides a comprehensive, efficient, and user-friendly way to track website usage and reward users for their time spent on the platform. 