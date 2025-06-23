# 🏆 Leaderboard Implementation

## Overview
A modern, real-time leaderboard system for tracking Roblox game rankings with live updates, animations, and comprehensive player statistics.

## 🚀 Features

### Core Functionality
- **Live Leaderboard Display**: Shows top 200 players with real-time updates
- **Auto-refresh**: Updates every 10 minutes automatically
- **Live Indicator**: Shows "LIVE" status when updated within 5 minutes
- **Search Functionality**: Find specific players by username
- **Responsive Design**: Works perfectly on desktop and mobile

### Three Tab System
1. **Main Tab**: Full leaderboard (top 200 players)
2. **Hottest Gainers**: Top 4 players who gained most RP in last 2 days
3. **Biggest Losers**: Top 4 players who lost most RP in last 2 days

### Interactive Elements
- **Click Username**: Links to player card if exists in the system
- **View on Roblox**: Direct links to Roblox profiles
- **Profile Pictures**: Fetched from Roblox API with fallback avatars
- **Rank Badges**: Color-coded based on position (gold, silver, bronze, etc.)

### Real-time Animations
- **Rank Changes**: Slide up/down animations with color coding
- **RP Changes**: Green/red glow effects with +/- indicators
- **Smooth Transitions**: 60fps animations for all updates
- **Loading States**: Shimmer effects during data fetches

## 🏗️ Technical Architecture

### Database Schema
```sql
-- Current leaderboard
leaderboard (
  id, username, rank_position, rp, rank_title, inserted_at
)

-- Historical snapshots
leaderboard_history (
  id, username, rank_position, rp, rank_title, inserted_at
)

-- RP change tracking
rp_changes (
  id, username, previous_rp, new_rp, rp_change, 
  previous_rank, new_rank, rank_change, change_timestamp
)

-- User cache for performance
roblox_user_cache (
  id, username, user_id, profile_picture, cached_at
)
```

### Key Queries
```sql
-- Current leaderboard
SELECT * FROM leaderboard ORDER BY rank_position LIMIT 200;

-- Hottest gainers (last 2 days)
SELECT username, SUM(rp_change) as total_gain 
FROM rp_changes 
WHERE change_timestamp >= NOW() - INTERVAL '2 days' AND rp_change > 0
GROUP BY username 
ORDER BY total_gain DESC LIMIT 4;

-- Biggest losers (last 2 days)  
SELECT username, SUM(rp_change) as total_loss
FROM rp_changes 
WHERE change_timestamp >= NOW() - INTERVAL '2 days' AND rp_change < 0
GROUP BY username 
ORDER BY total_loss ASC LIMIT 4;
```

## 🛠️ Implementation Details

### File Structure
```
src/
├── components/leaderboard/
│   ├── LeaderboardEntry.tsx      # Individual entry component
│   └── StatsCard.tsx             # Gainers/Losers cards
├── hooks/
│   └── useLeaderboard.ts         # State management hook
├── services/
│   ├── leaderboardService.ts     # Supabase data fetching
│   └── robloxApi.ts              # Roblox API integration
├── types/
│   └── leaderboard.ts            # TypeScript definitions
└── pages/
    └── LeaderboardPage.tsx       # Main leaderboard page
```

### Key Components

#### LeaderboardEntry.tsx
- Displays individual player entries
- Handles rank badges and profile pictures
- Shows rank/RP change animations
- Links to player cards and Roblox profiles

#### StatsCard.tsx
- Displays hottest gainers and biggest losers
- Shows RP change statistics
- Interactive player links

#### useLeaderboard.ts
- Manages leaderboard state
- Handles auto-refresh logic
- Provides search and filtering
- Manages loading and error states

### API Integration

#### Roblox API Endpoints
```typescript
// Search for user by username
GET https://users.roblox.com/v1/users/search?keyword={username}&limit=1

// Get profile picture
GET https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={user_id}&size=150x150&format=Png
```

#### Caching Strategy
- User data cached for 30 minutes
- Profile pictures cached for 30 minutes
- Reduces API calls and improves performance

## 🎨 Styling & Animations

### CSS Animations
```css
/* Slide animations for rank changes */
@keyframes slide-up {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes slide-down {
  0% { transform: translateY(-20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

/* Glow effects for RP changes */
@keyframes glow-green {
  0%, 100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.3); }
  50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.6); }
}

@keyframes glow-red {
  0%, 100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
}
```

### Color Scheme
- **Gold**: Top 3 positions
- **Silver**: Positions 4-10
- **Bronze**: Positions 11-50
- **Blue**: Positions 51-100
- **Gray**: Positions 101+

## 🔧 Configuration

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup
1. Create the required tables in your Supabase database
2. Set up Row Level Security (RLS) policies
3. Configure real-time subscriptions if needed

### Roblox API
- No API key required for public endpoints
- Rate limiting: 100 requests per minute
- Caching implemented to minimize API calls

## 🚀 Usage

### Navigation
The leaderboard is accessible via:
- Header navigation (Trophy icon)
- Direct URL: `/leaderboard`

### Features
1. **View Leaderboard**: See top 200 players
2. **Search Players**: Use the search bar to find specific players
3. **View Gainers/Losers**: Switch tabs to see trending players
4. **Click Players**: Navigate to player cards or Roblox profiles
5. **Refresh Data**: Manual refresh button for immediate updates

### Responsive Design
- **Desktop**: Full layout with all features
- **Tablet**: Optimized layout with collapsible elements
- **Mobile**: Stacked layout with touch-friendly interactions

## 🔄 Auto-refresh Logic

### Update Schedule
- **Frequency**: Every 10 minutes
- **Live Threshold**: 5 minutes (shows "LIVE" indicator)
- **Manual Refresh**: Available via button

### Data Flow
1. Fetch current leaderboard data
2. Compare with previous data
3. Animate changes (rank/RP movements)
4. Update UI with new information
5. Cache Roblox data for performance

## 🎯 Performance Optimizations

### Caching
- Roblox user data: 30 minutes
- Profile pictures: 30 minutes
- Database queries: Optimized with proper indexing

### Lazy Loading
- Profile pictures loaded on demand
- Error handling for failed image loads
- Fallback avatars for missing images

### Animation Performance
- CSS transforms for smooth 60fps animations
- Hardware acceleration enabled
- Debounced search input

## 🐛 Error Handling

### Graceful Fallbacks
- Missing profile pictures → Initial avatar
- API failures → Cached data or fallbacks
- Network issues → Retry mechanisms
- Invalid data → Error boundaries

### User Feedback
- Loading spinners during data fetches
- Error messages with retry options
- Empty states for no data
- Success indicators for updates

## 🔮 Future Enhancements

### Potential Features
- **Real-time WebSocket updates**
- **Player comparison tools**
- **Historical trend charts**
- **Export functionality**
- **Advanced filtering options**
- **Mobile app integration**

### Performance Improvements
- **Virtual scrolling** for large datasets
- **Service Worker** for offline support
- **Progressive Web App** features
- **Advanced caching strategies**

## 📝 Development Notes

### Testing
- Test with various data scenarios
- Verify responsive design on different devices
- Check animation performance
- Validate API error handling

### Deployment
- Ensure environment variables are set
- Verify Supabase connection
- Test Roblox API integration
- Monitor performance metrics

---

**Built with React, TypeScript, Tailwind CSS, and Supabase**
**Roblox API integration for real-time player data**
**Modern animations and responsive design** 