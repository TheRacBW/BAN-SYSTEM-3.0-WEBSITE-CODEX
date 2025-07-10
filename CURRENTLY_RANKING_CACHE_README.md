# Currently Ranking Cache System

## Overview

The currently ranking cache system is designed to reduce Supabase egress by intelligently caching currently ranking data with smart invalidation based on refresh triggers. **This system now matches the behavior of other cache systems by clearing cache instead of updating it, and includes auto-refresh for active viewers.**

## How It Works

### Cache Lifecycle

1. **Initial Load**: When a user visits the "Currently Ranking" tab, the system first checks for cached data
2. **Cache Hit**: If valid cached data exists, it's served immediately (reducing Supabase calls)
3. **Cache Miss**: If no cache exists or it's expired, fresh data is fetched from Supabase
4. **Trigger Response**: When a refresh trigger is detected, the cache is **cleared** after 30 seconds (not updated)
5. **Auto-Refresh**: If user is actively viewing the tab, data is automatically refreshed

### Auto-Refresh for Active Viewers

The system tracks tab visibility and only auto-refreshes for users actively viewing the Currently Ranking tab:

- **Active Viewer**: Gets immediate auto-refresh when cache is cleared
- **Inactive User**: Cache cleared, but no auto-refresh (fresh data on next visit)
- **Multiple Users**: Only those actively viewing get auto-refresh

### Timing Strategy

- **30-second Window**: After a refresh trigger, cache is cleared after 30 seconds to allow backend processing
- **Event-Driven Invalidation**: Cache is cleared via `currently_ranking_cache_cleared` event
- **Smart Auto-Refresh**: Only active viewers get immediate refresh
- **Fresh Data on Next Request**: After cache is cleared, next user interaction fetches fresh data

### Cache Keys

- `currently_ranking_v1`: Stores the currently ranking data with metadata

### Cache Structure

```typescript
{
  data: LeaderboardEntry[],
  timestamp: number
}
```

## Implementation Details

### Files Modified

1. **`src/utils/leaderboardCache.ts`**
   - Added `getCachedCurrentlyRanking()`
   - Added `setCachedCurrentlyRanking()`
   - Added `clearCurrentlyRankingCache()`
   - Added `getCurrentlyRankingCacheStatus()`
   - Enhanced `setupCacheInvalidationListener()` to clear cache (not update)

2. **`src/hooks/useLeaderboard.ts`**
   - Added `useCurrentlyRanking()` hook
   - Implements cache-first strategy
   - Listens for `currently_ranking_cache_cleared` events
   - **NEW**: Tracks tab visibility with `setTabVisibility()`
   - **NEW**: Auto-refresh only for active viewers
   - Provides cache status information

3. **`src/pages/LeaderboardPage.tsx`**
   - Updated to use the new `useCurrentlyRanking()` hook
   - **NEW**: Tracks tab visibility changes
   - **NEW**: Visual indicators for cache status and active state
   - Removed direct Supabase calls for currently ranking data

### Cache Status Information

The system provides detailed cache status including:
- Whether cache exists
- Cache expiration status
- **NEW**: Auto-refresh status (refreshing, fresh, expired, error)
- **NEW**: Active viewer status

## Benefits

1. **Reduced Egress**: Significantly fewer Supabase calls for currently ranking data
2. **Better Performance**: Faster loading when cache is available
3. **Smart Invalidation**: Cache clears automatically based on data freshness
4. **User Experience**: Seamless experience with cached data while fresh data loads on next interaction
5. **Consistent Behavior**: Matches other cache systems (leaderboard, gainers/losers)
6. **Precise Targeting**: Auto-refresh only for active viewers
7. **Visual Feedback**: Users can see cache status and active state

## Corrected Flow

### **Timeline:**
10:00:00 - User loads Currently Ranking → Uses cache
10:05:00 - User switches tabs → Uses same cache
10:10:00 - Lua script runs → Trigger fires
10:10:30 - Cache cleared (30s delay)
10:10:30 - **Active viewers get auto-refresh** ✅
10:11:00 - Inactive users return → Fetches fresh data + caches it
10:15:00 - User loads page again → Uses fresh cache
10:20:00 - Next Lua script cycle...

## Auto-Refresh Behavior

### **User actively viewing Currently Ranking tab:**
Trigger fires → Auto-refresh immediately → See fresh data ✅

### **User on different page/tab:**
Trigger fires → Cache cleared → No auto-refresh → Fresh data on next visit ✅

### **Multiple users scenario:**
- User A viewing Currently Ranking → Gets auto-refresh ✅
- User B on Leaderboard tab → No auto-refresh ✅
- User C on different page → No auto-refresh ✅

## Monitoring

The system logs detailed information about cache operations:
- `🔥 Using cached currently ranking data` - Cache hit
- `🔄 Fetching fresh currently ranking data from Supabase` - Cache miss  
- `💾 Cached currently ranking data` - Data cached
- `🗑️ Cleared currently ranking cache` - Cache cleared ✅
- `🔄 Currently ranking cache cleared event received` - Event received ✅
- `👁️ User actively viewing Currently Ranking, auto-refreshing` - Auto-refresh for active viewer ✅
- `👤 User not viewing Currently Ranking, skipping auto-refresh` - Skipped for inactive user ✅
- `✅ Auto-refreshed for active viewer` - Auto-refresh completed ✅

## Usage Example

```typescript
const {
  currentlyRanking,
  isLoading,
  error,
  isUsingCache,
  cacheStatus,
  fetchCurrentlyRanking,
  refresh,
  setTabVisibility,
  isTabVisible
} = useCurrentlyRanking();
```

The `cacheStatus` will show:
- `Cached` - Using cached data
- `refreshing` - Auto-refresh in progress
- `fresh` - Just refreshed
- `expired` - Cache expired, will fetch fresh on next visit
- `error` - Refresh failed

## Visual Indicators

The UI now shows:
- **Cache status badges**: 💾 Cached, 🔄 Refreshing, ✨ Fresh, ⏰ Expired, ❌ Error
- **Active viewer indicator**: 👁️ Active (only shown when tab is visible)

## Key Features

### **Previous (Wrong):**
- Updated cache with potentially stale data
- Kept cache valid regardless of data freshness

### **Current (Correct):**
- **Clears cache** when new data arrives
- **Forces fresh fetch** on next user interaction
- **Guarantees fresh data** including new insights
- **Matches other cache systems** behavior
- **Auto-refresh for active viewers** only
- **Precise targeting** reduces unnecessary API calls 