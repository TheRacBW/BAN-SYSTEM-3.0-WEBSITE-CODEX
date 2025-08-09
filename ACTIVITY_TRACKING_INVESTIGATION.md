# Activity Tracking Investigation Report

## 🔍 Issues Identified

Based on the screenshots and code analysis, there are several critical issues with daily activity tracking:

### **Problem 1: Double Counting Across Multiple Accounts**

**Issue**: The frontend is summing daily minutes across ALL accounts for a player:
```typescript
// PlayerCard.tsx line 1550-1551
dailyMinutesToday={playerData.accounts.reduce((sum, acc) => 
  sum + (acc.status?.dailyMinutesToday || 0), 0)}
```

**Examples from Screenshots**:
- **Phin**: Shows 5d 9h today, but has 2 accounts (NyrokeSama, NyrokeLovesDaveyAlot)
- **wdz**: Shows 4h 12m today

**Problem**: If a player plays on multiple accounts simultaneously or switches between accounts, their daily minutes are being added together, inflating the total time.

### **Problem 2: Inconsistent Activity Tracking Logic**

**Issue**: Different parts of the system use different logic for what counts as "activity":

#### Supabase Function (roblox-status/index.ts):
```typescript
// Lines 401-406: Counts ALL online time
if (isNowOnlineState && existingStatus?.last_updated) {
  const minutesSinceUpdate = Math.min(30, Math.max(0, (now.getTime() - lastUpdate.getTime()) / 60000));
  updateData.daily_minutes_today = (updateData.daily_minutes_today || 0) + minutesSinceUpdate;
}
```

#### Activity Tracking (activityTracking.ts):
```typescript
// Lines 361-368: Only counts meaningful activity
const isMeaningfulActivity = currentStatus.inBedwars || currentStatus.isInGame;
if (isMeaningfulActivity) {
  updateData.daily_minutes_today = (updateData.daily_minutes_today || 0) + minutesSinceUpdate;
  updateData.daily_minutes_today = Math.min(720, updateData.daily_minutes_today);
}
```

**Problem**: The Supabase function tracks all online time, while the activity tracking only counts "meaningful" activity. This creates inconsistent data.

### **Problem 3: Last Seen vs Daily Time Mismatch**

**Examples**:
- **Phin**: Last seen 3d ago, but shows 5d 9h today ❌
- **wdz**: Last seen 1d ago, but shows 4h 12m today ❌

**Issue**: The daily time is being accumulated over multiple days without proper daily reset logic, or there's a timezone/reset timing issue.

## 🛠️ Root Cause Analysis

### **1. Multiple Data Sources**
- **Supabase Edge Function**: Updates activity in real-time
- **Frontend Activity Tracking**: Alternative tracking logic
- **Database Functions**: Additional tracking in migrations

### **2. Aggregation Logic**
```typescript
// Current aggregation (PROBLEMATIC)
const totalDailyMinutes = playerAccounts.reduce((sum, acc) => 
  sum + (acc.status?.dailyMinutesToday || 0), 0);
```
This assumes each account represents independent playtime, but:
- Players can't play multiple accounts simultaneously
- Account switching should not double-count time
- Daily time should represent TOTAL time spent today, not sum across accounts

### **3. Day Reset Logic Issues**
```typescript
// Day reset in multiple places
const needsDayReset = !existingStatus?.last_reset_date || 
                     existingStatus.last_reset_date !== today;
```
Issues:
- Different timezone handling across functions
- Potential race conditions in reset logic
- Missing caps on historical data

## 🔧 Proposed Solutions

### **Solution 1: Fix Account Aggregation**

Instead of summing daily minutes, use the **maximum** daily minutes across accounts:

```typescript
// FIXED: Use max instead of sum for daily time
const maxDailyMinutes = Math.max(...playerData.accounts.map(acc => 
  acc.status?.dailyMinutesToday || 0));

// Alternative: Use most recently active account's daily time
const mostRecentAccount = playerData.accounts
  .filter(acc => acc.status?.dailyMinutesToday > 0)
  .sort((a, b) => new Date(b.status.lastUpdated).getTime() - new Date(a.status.lastUpdated).getTime())[0];
const dailyMinutes = mostRecentAccount?.status?.dailyMinutesToday || 0;
```

### **Solution 2: Standardize Activity Tracking**

Ensure all tracking functions use the same "meaningful activity" definition:

```typescript
// Standardized meaningful activity check
const isMeaningfulActivity = (status: any) => 
  status.inBedwars || status.isInGame;

// Apply consistently across all tracking functions
```

### **Solution 3: Improve Day Reset Logic**

```typescript
// Unified day reset with timezone handling
const getPlayerTimezone = (activityDistribution: any) => {
  // Use activity patterns to detect timezone
  // Apply consistent reset timing
};

const resetDailyDataIfNeeded = (lastReset: string, timezone: string) => {
  const playerNow = new Date().toLocaleString("en-US", {timeZone: timezone});
  const playerToday = new Date(playerNow).toISOString().split('T')[0];
  return lastReset !== playerToday;
};
```

### **Solution 4: Add Data Validation**

```typescript
// Validate daily time against last seen
const validateDailyTime = (dailyMinutes: number, lastSeen: string) => {
  const lastSeenDate = new Date(lastSeen);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  
  // If last seen before today, daily minutes should be 0
  if (lastSeenDate.getTime() < todayStart) {
    return 0;
  }
  
  // Cap daily minutes to time since last seen
  const maxPossibleMinutes = Math.min(720, 
    (Date.now() - lastSeenDate.getTime()) / 60000);
  
  return Math.min(dailyMinutes, maxPossibleMinutes);
};
```

## 📊 Expected Behavior

### **Correct Daily Time Calculation**:
1. **Single Account Player**: `daily_minutes_today` from their account
2. **Multi-Account Player**: `MAX(daily_minutes_today)` across accounts (not sum)
3. **Validation**: Daily time ≤ time since last activity reset
4. **Consistency**: All tracking functions use same activity definition

### **Correct Last Seen Logic**:
1. Find most recent meaningful activity across all accounts
2. Display account name where last seen
3. Ensure daily time aligns with last seen timing

## 🎯 Implementation Priority

1. **HIGH**: Fix account aggregation (use max instead of sum)
2. **HIGH**: Standardize meaningful activity definition
3. **MEDIUM**: Add data validation against last seen
4. **MEDIUM**: Improve day reset logic with timezone handling
5. **LOW**: Add monitoring/logging for tracking accuracy