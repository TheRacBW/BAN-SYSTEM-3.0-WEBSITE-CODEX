# Activity Pulse System

The Activity Pulse system provides intelligent activity tracking and insights for Roblox Bedwars players across multiple accounts.

## Features

### 🎯 Core Functionality
- **Daily Activity Tracking**: Tracks minutes played per day with automatic daily resets
- **Weekly Averages**: Calculates 7-day rolling averages for activity trends
- **Multi-Account Aggregation**: Combines data across all player accounts
- **Timezone Detection**: Automatically detects player timezone based on activity patterns
- **Peak Hours Analysis**: Identifies when players are most active
- **Temporary Disconnect Handling**: Intelligently handles brief disconnections (< 5 minutes)

### 📊 Activity Levels
- **🔥 Very Active** (120+ min/day): High engagement players
- **⚡ Moderately Active** (60-120 min/day): Regular players
- **💧 Lightly Active** (15-60 min/day): Casual players
- **😴 Inactive** (<15 min/day): Low engagement players

### 📈 Trend Analysis
- **📈 Trending Up**: Increasing activity (20%+ increase)
- **📉 Trending Down**: Decreasing activity (20%+ decrease)
- **➖ Stable**: Consistent activity levels

### 🌍 Timezone Detection
- **EST (US East)**: Peak activity 2pm-6pm
- **PST (US West)**: Peak activity 5pm-9pm
- **GMT (UK)**: Peak activity 7pm-11pm
- **CET (EU)**: Peak activity 9pm-1am
- **JST (Japan)**: Peak activity 12am-4am
- **AEST (Australia)**: Peak activity 6am-10am

## Database Schema

### New Columns Added to `roblox_user_status`

```sql
-- Activity Pulse Core Data
daily_minutes_today INTEGER DEFAULT 0,
daily_minutes_yesterday INTEGER DEFAULT 0,
weekly_total_minutes INTEGER DEFAULT 0,
weekly_average DECIMAL(5,2) DEFAULT 0,
activity_trend TEXT DEFAULT 'stable' 
  CHECK (activity_trend IN ('increasing', 'decreasing', 'stable')),
preferred_time_period TEXT DEFAULT 'unknown'
  CHECK (preferred_time_period IN ('morning', 'afternoon', 'evening', 'night', 'unknown')),
last_reset_date DATE DEFAULT CURRENT_DATE;

-- Timezone & Peak Hours
detected_timezone TEXT DEFAULT 'unknown',
peak_hours_start INTEGER DEFAULT NULL, -- Hour 0-23
peak_hours_end INTEGER DEFAULT NULL,   -- Hour 0-23
activity_distribution JSONB DEFAULT '{}', -- {"14": 45, "15": 60, "16": 30} minutes per hour
last_disconnect_time TIMESTAMP WITH TIME ZONE,
session_start_time TIMESTAMP WITH TIME ZONE;
```

## Components

### ActivityPulse Component
Located at `src/components/ActivityPulse.tsx`

**Props:**
```typescript
interface ActivityPulseProps {
  // Core activity data
  dailyMinutesToday: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown';
  lastOnlineTimestamp?: string;
  isCurrentlyOnline: boolean;
  
  // Timezone & hours data
  detectedTimezone?: string;
  peakHoursStart?: number;
  peakHoursEnd?: number;
  activityDistribution?: Record<string, number>;
  
  // Display options
  compact?: boolean;
  showTimezoneAnalysis?: boolean;
  showDetailedStats?: boolean;
}
```

**Features:**
- Compact and detailed view modes
- Real-time activity indicators
- Timezone display with peak hours
- Trend visualization with icons
- Activity level color coding

### Activity Tracking Utilities
Located at `src/lib/activityTracking.ts`

**Key Functions:**
- `detectTimezoneFromActivity()`: Analyzes activity patterns to determine timezone
- `calculatePeakHours()`: Finds consecutive hours with highest activity
- `aggregatePlayerActivity()`: Combines data across multiple accounts
- `updateActivityPulseData()`: Updates activity data in database

## Integration

### Player Cards
Activity Pulse is integrated into player cards showing:
- Compact activity level indicator
- Trend direction
- Online status
- Daily minutes played

### Player Modal
Detailed view in player modal includes:
- Full activity overview section
- Individual account activities
- Timezone analysis
- Peak hours display
- Activity distribution insights

### Status Tracking
The `roblox-status` Supabase function has been enhanced to:
- Track daily minutes automatically
- Calculate weekly averages
- Detect timezone patterns
- Handle temporary disconnections
- Update activity distribution by hour

## Usage Examples

### Basic Activity Pulse Display
```tsx
<ActivityPulse
  dailyMinutesToday={120}
  weeklyAverage={85.5}
  activityTrend="increasing"
  preferredTimePeriod="evening"
  isCurrentlyOnline={true}
  compact={true}
/>
```

### Multi-Account Aggregation
```tsx
const aggregatedData = aggregatePlayerActivity(playerAccounts);

<ActivityPulse
  dailyMinutesToday={aggregatedData.totalDailyMinutes}
  weeklyAverage={aggregatedData.avgWeeklyAverage}
  activityTrend={aggregatedData.activityTrend}
  preferredTimePeriod={aggregatedData.preferredTimePeriod}
  detectedTimezone={aggregatedData.detectedTimezone}
  peakHoursStart={aggregatedData.peakHours?.start}
  peakHoursEnd={aggregatedData.peakHours?.end}
  isCurrentlyOnline={aggregatedData.isCurrentlyOnline}
  compact={false}
/>
```

## Data Flow

1. **Status Updates**: `roblox-status` function updates player status every 2 minutes
2. **Activity Calculation**: Minutes online are added to daily totals
3. **Timezone Detection**: Activity patterns are analyzed for timezone inference
4. **Peak Hours**: Consecutive high-activity hours are identified
5. **Aggregation**: Multi-account data is combined for player-level insights
6. **Display**: ActivityPulse component renders insights in UI

## Performance Considerations

- **Efficient Storage**: ~50 bytes per player total
- **Smart Indexing**: Database indexes on activity columns
- **Cached Calculations**: Weekly averages computed once per day
- **Lazy Loading**: Activity data loaded only when needed

## Testing

Run the test suite:
```bash
npm test tests/activity-pulse.test.ts
```

Tests cover:
- Timezone detection accuracy
- Peak hours calculation
- Multi-account aggregation
- Edge cases and error handling

## Future Enhancements

- **Advanced Analytics**: Machine learning for better timezone detection
- **Activity Predictions**: Forecast when players will be online
- **Team Insights**: Compare activity patterns across teammates
- **Historical Trends**: Long-term activity analysis
- **Custom Timezones**: Support for more timezone regions

## Migration

The system automatically adds new columns to existing `roblox_user_status` tables. No manual migration required - the system will populate activity data as players come online.

## Troubleshooting

### No Activity Data Showing
- Ensure `roblox-status` function is running
- Check that players have been online recently
- Verify database columns were added successfully

### Incorrect Timezone Detection
- Activity patterns need 24+ hours of data
- Multiple timezone accounts may show "Mixed timezones"
- Peak hours calculation requires sufficient activity spread

### Performance Issues
- Check database indexes are created
- Monitor `roblox-status` function execution time
- Consider reducing status update frequency if needed 