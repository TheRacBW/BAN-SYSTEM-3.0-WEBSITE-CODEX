# Frontend Ranking System Documentation

## Overview

The leaderboard system has been updated to handle raw data from a simplified Roblox script and perform all 21-tier rank calculations on the frontend side. This approach provides better performance, flexibility, and maintainability.

## Key Changes

### 1. Simplified Roblox Script
- **File**: `roblox_scripts/simplified_leaderboard_script.lua`
- **Purpose**: Only sends raw data without any calculations
- **Data Structure**:
  ```lua
  {
    username = "PlayerName",
    rank_position = 1,
    rp = 1500, -- Raw RP value from game
    rank_title = "Platinum 3" -- Raw rank title from game
  }
  ```

### 2. Frontend Rank Calculation System
- **File**: `src/utils/rankingSystem.ts`
- **Purpose**: Complete 21-tier ranking system with all calculations
- **Features**:
  - Cached calculations for performance
  - Comprehensive rank utilities
  - Tier progression logic
  - Change detection and animations

## 21-Tier Ranking System

### Tier Structure
```
Bronze 1-4 (0-399 RP) → Silver 1-4 (400-799 RP) → Gold 1-4 (800-1199 RP)
Platinum 1-4 (1200-1599 RP) → Diamond 1-3 (1600-1899 RP) → Emerald (1900-1999 RP) → Nightmare (2000+ RP)
```

### Rank Calculation Logic
- Each tier requires 100 RP to progress
- Example: 1250 total RP = Platinum 1 with 50 RP display
- Special tiers (Emerald, Nightmare) have no sub-levels

## Data Flow

### 1. Raw Data from Roblox
```typescript
interface RawLeaderboardEntry {
  username: string;
  rank_position: number;
  rp: number; // Raw RP value from game
  rank_title: string; // Raw rank title from game
  inserted_at: string;
  profile_picture?: string | null;
  user_id?: number | null;
}
```

### 2. Frontend Processing
```typescript
// Process raw data and calculate ranks
const processedData = rawData.map(entry => {
  const calculatedRank = calculateRankFromRPCached(entry.rp);
  return {
    ...entry,
    calculatedRank,
    // Legacy fields for backward compatibility
    calculated_rank_tier: calculatedRank.tier,
    calculated_rank_number: calculatedRank.level,
    display_rp: calculatedRank.displayRP,
    total_rp: calculatedRank.totalRP
  };
});
```

### 3. Enhanced Entry Structure
```typescript
interface LeaderboardEntry extends RawLeaderboardEntry {
  // Legacy calculated fields (backward compatibility)
  calculated_rank_tier?: RankTier;
  calculated_rank_number?: number;
  display_rp?: number;
  total_rp?: number;
  
  // New frontend-calculated fields
  calculatedRank?: CalculatedRank | null;
}
```

## Core Components

### 1. Ranking System Utilities (`src/utils/rankingSystem.ts`)

#### Key Functions:
- `calculateRankFromRP(totalRP: number)`: Calculate rank from total RP
- `calculateRankFromRPCached(totalRP: number)`: Cached version for performance
- `getRankTierInfo(tier: RankTier)`: Get tier styling information
- `getRankDisplayName(tier: RankTier, level: number)`: Get formatted rank name
- `isTierPromotion(oldRank, newRank)`: Check for tier promotion
- `isTierDemotion(oldRank, newRank)`: Check for tier demotion

#### Caching System:
```typescript
const rankCache = new Map<number, CalculatedRank>();

export function calculateRankFromRPCached(totalRP: number): CalculatedRank {
  const cacheKey = Math.floor(totalRP);
  
  if (rankCache.has(cacheKey)) {
    return rankCache.get(cacheKey)!;
  }
  
  const calculatedRank = calculateRankFromRP(totalRP);
  rankCache.set(cacheKey, calculatedRank);
  
  // Limit cache size
  if (rankCache.size > 1000) {
    const firstKey = rankCache.keys().next().value;
    if (firstKey !== undefined) {
      rankCache.delete(firstKey);
    }
  }
  
  return calculatedRank;
}
```

### 2. Updated Leaderboard Service (`src/services/leaderboardService.ts`)

#### Key Changes:
- Accepts raw data from Supabase
- Calculates all ranks on frontend
- Maintains backward compatibility
- Enhanced sorting by calculated ranks

#### Data Processing Pipeline:
```typescript
private processRawData(rawData: RawLeaderboardEntry[]): LeaderboardEntry[] {
  return rawData.map(entry => {
    const calculatedRank = isValidRP(entry.rp) ? calculateRankFromRPCached(entry.rp) : null;
    
    return {
      ...entry,
      calculatedRank,
      // Legacy fields for backward compatibility
      calculated_rank_tier: calculatedRank?.tier,
      calculated_rank_number: calculatedRank?.level,
      display_rp: calculatedRank?.displayRP,
      total_rp: calculatedRank?.totalRP
    };
  });
}
```

### 3. Updated Components

#### RankBadge Component:
- Uses new ranking system utilities
- Displays calculated ranks with proper styling
- Supports progress indicators and animations

#### LeaderboardEntry Component:
- Handles calculated ranks from raw data
- Shows tier changes and RP progress
- Maintains animation system for rank changes

#### StatsCard Component:
- Displays calculated ranks for gainers/losers
- Handles raw RP data with frontend calculations

### 4. Updated Hook (`src/hooks/useLeaderboard.ts`)

#### Enhanced Features:
- Search by calculated rank names
- Filter gainers/losers by calculated ranks
- Performance optimizations with useMemo
- Better error handling and data validation

## Performance Optimizations

### 1. Caching
- Rank calculations are cached to avoid repeated computations
- Cache size is limited to prevent memory issues
- Cache keys are based on integer RP values

### 2. Memoization
- Search results are memoized with useMemo
- Filtered data is cached until dependencies change
- Component re-renders are minimized

### 3. Efficient Sorting
- Uses calculated tier indices for fast sorting
- Maintains sorted order during updates
- Optimized for large datasets

## Backward Compatibility

### Legacy Data Support
- Existing data with calculated fields continues to work
- New raw data is processed alongside legacy data
- Gradual migration path available

### Type Safety
- Updated TypeScript types support both old and new data structures
- Null safety for calculated rank fields
- Proper error handling for invalid data

## Error Handling

### Data Validation
```typescript
export function isValidRP(rp: number): boolean {
  return typeof rp === 'number' && !isNaN(rp) && rp >= 0 && rp <= 10000;
}
```

### Graceful Fallbacks
- Invalid RP values default to Bronze 1
- Missing calculated ranks are computed on-demand
- Network errors are handled with retry logic

## Animation System

### Rank Change Animations
- Tier promotions trigger green glow effects
- Tier demotions trigger red glow effects
- RP changes show visual indicators
- Smooth 60fps animations with CSS transitions

### Animation Triggers
```typescript
const hasTierUp = isTierPromotion(previousRank!, currentRank);
const hasTierDown = isTierDemotion(previousRank!, currentRank);
const hasGainedRP = rpChange > 0;
const hasLostRP = rpChange < 0;
```

## Search Functionality

### Enhanced Search
- Search by username
- Search by calculated rank names
- Search by raw rank titles (legacy)
- Real-time filtering with debouncing

### Search Implementation
```typescript
const filteredEntries = useMemo(() => {
  if (!state.searchQuery.trim()) {
    return state.entries;
  }

  const query = state.searchQuery.toLowerCase();
  return state.entries.filter(entry => {
    // Search by username
    if (entry.username.toLowerCase().includes(query)) {
      return true;
    }

    // Search by calculated rank
    const calculatedRank = entry.calculatedRank || 
      (entry.rp !== undefined ? calculateRankFromRPCached(entry.rp) : null);
    
    if (calculatedRank) {
      const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
      if (rankName.includes(query)) {
        return true;
      }
    }

    return false;
  });
}, [state.entries, state.searchQuery]);
```

## Testing

### Unit Tests
- Rank calculation accuracy
- Tier progression logic
- Cache performance
- Error handling

### Integration Tests
- Data flow from Roblox to frontend
- Component rendering with calculated ranks
- Search functionality
- Animation triggers

## Configuration

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Roblox Script Configuration
```lua
local SUPABASE_URL = "YOUR_SUPABASE_URL"
local SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"
local UPDATE_INTERVAL = 600 -- 10 minutes
local MAX_PLAYERS = 200
```

## Deployment

### Build Process
```bash
npm run build
```

### Production Considerations
- Minified and optimized bundle
- CDN caching for static assets
- Environment-specific configurations
- Error monitoring and logging

## Monitoring and Debugging

### Performance Monitoring
- Rank calculation timing
- Cache hit rates
- Component render performance
- Network request optimization

### Debug Tools
- Browser developer tools
- React DevTools for component inspection
- Network tab for API calls
- Console logging for rank calculations

## Future Enhancements

### Planned Features
- Real-time WebSocket updates
- Advanced filtering options
- Export functionality
- Mobile app integration
- Analytics dashboard

### Performance Improvements
- Virtual scrolling for large datasets
- Service worker caching
- Progressive web app features
- Advanced animation system

## Troubleshooting

### Common Issues

#### 1. Rank Calculations Not Working
- Check if raw RP data is valid
- Verify ranking system utilities are imported
- Ensure cache is not corrupted

#### 2. Animations Not Triggering
- Verify previous entry data exists
- Check animation CSS classes
- Ensure rank change detection is working

#### 3. Search Not Finding Results
- Check search query format
- Verify calculated ranks are available
- Test with different search terms

### Debug Commands
```typescript
// Clear rank cache
clearRankCache();

// Validate RP value
isValidRP(1500); // true

// Calculate rank manually
calculateRankFromRP(1500); // { tier: 'Platinum', level: 3, ... }
```

## Conclusion

The frontend ranking system provides a robust, performant, and maintainable solution for handling raw leaderboard data from Roblox. By moving all calculations to the frontend, the system gains flexibility, better performance, and easier debugging capabilities while maintaining full backward compatibility with existing data. 