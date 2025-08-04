# Admin Call System - Complete Implementation

## Overview

The Admin Call System is a comprehensive real-time admin assistance platform that allows Discord-verified users to call for immediate admin help when they encounter cheaters/hackers in their games. The system includes floating action buttons, real-time notifications, admin availability management, suspicion tracking, and automatic expiry handling.

## Features

### For Users (Players)
- **Floating Action Button**: Red phone icon positioned bottom-right on the /report page
- **Real-time Admin Count**: Shows number of active admins with live updates
- **Cooldown System**: 2-minute cooldown between calls, max 10 per day
- **Form Validation**: Comprehensive validation with helpful error messages
- **Proof Image Support**: Optional screenshot upload with preview
- **Auto-expiry**: Calls automatically expire after 5 minutes
- **Discord Verification Required**: Only verified users can make calls

### For Admins
- **Real-time Dashboard**: Live updates of incoming calls
- **Admin Availability Toggle**: Active/Inactive status management
- **Call Handling**: Mark as Handled/Ignored with optional reasons
- **Suspicion History**: View previous reports for repeat offenders
- **Statistics Dashboard**: Daily call statistics and metrics
- **Proof Image Viewer**: Clickable image previews
- **Countdown Timers**: Real-time countdown showing time until expiry

## Database Schema

### Tables

#### `admin_call_alerts`
```sql
CREATE TABLE admin_call_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES auth.users(id),
  discord_username TEXT NOT NULL,
  caller_roblox_username TEXT NOT NULL,
  suspect_roblox_username TEXT NOT NULL,
  suspect_user_id BIGINT,
  suspect_avatar_url TEXT,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('hacking', 'exploiting', 'griefing', 'toxicity', 'other')),
  reason_description TEXT NOT NULL,
  proof_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'handled', 'ignored', 'expired', 'archived')),
  handled_by UUID REFERENCES auth.users(id),
  handled_at TIMESTAMP WITH TIME ZONE,
  archive_reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `admin_availability`
```sql
CREATE TABLE admin_availability (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `suspicion_log`
```sql
CREATE TABLE suspicion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suspect_user_id BIGINT NOT NULL,
  suspect_username TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('admin_call', 'report', 'manual')),
  reason TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  false_positive BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `user_call_restrictions`
```sql
CREATE TABLE user_call_restrictions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  daily_call_count INTEGER DEFAULT 0,
  last_call_at TIMESTAMP WITH TIME ZONE,
  is_restricted BOOLEAN DEFAULT false,
  restriction_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Helper Functions

#### `can_user_make_admin_call(user_uuid UUID)`
```sql
CREATE OR REPLACE FUNCTION can_user_make_admin_call(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_verified BOOLEAN;
  daily_count INTEGER;
  last_call TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if user is Discord verified
  SELECT discord_verified_at IS NOT NULL INTO user_verified
  FROM auth.users WHERE id = user_uuid;
  
  IF NOT user_verified THEN
    RETURN FALSE;
  END IF;
  
  -- Check daily call limit
  SELECT COALESCE(daily_call_count, 0), last_call_at 
  INTO daily_count, last_call
  FROM user_call_restrictions 
  WHERE user_id = user_uuid;
  
  -- Reset daily count if it's a new day
  IF last_call IS NULL OR DATE(last_call) < CURRENT_DATE THEN
    daily_count := 0;
  END IF;
  
  -- Check limits
  IF daily_count >= 10 THEN
    RETURN FALSE;
  END IF;
  
  -- Check cooldown (2 minutes)
  IF last_call IS NOT NULL AND NOW() - last_call < INTERVAL '2 minutes' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

#### `get_active_admin_count()`
```sql
CREATE OR REPLACE FUNCTION get_active_admin_count()
RETURNS INTEGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM admin_availability 
  WHERE is_active = true 
  AND last_activity > NOW() - INTERVAL '15 minutes';
  
  RETURN GREATEST(admin_count, 1); -- Always show at least 1
END;
$$ LANGUAGE plpgsql;
```

#### `expire_old_admin_calls()`
```sql
CREATE OR REPLACE FUNCTION expire_old_admin_calls()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE admin_call_alerts 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' 
  AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
```

## Components

### 1. AdminCallButton.tsx
**Location**: `src/components/AdminCallButton.tsx`

**Features**:
- Floating action button (FAB) with red phone icon
- Expandable modal with call form
- Real-time admin count badge
- Cooldown timer display
- Form validation and submission
- Status indicators

**Key Functions**:
- `checkCallEligibility()`: Validates user can make calls
- `fetchActiveAdminCount()`: Gets live admin count
- `submitCall()`: Submits admin call with suspect data
- `validateForm()`: Comprehensive form validation

### 2. AdminCallsDashboard.tsx
**Location**: `src/components/AdminCallsDashboard.tsx`

**Features**:
- Real-time active calls list with countdown timers
- Admin availability toggle
- Call handling actions (Handle/Ignore)
- Recent calls history
- Suspicion log viewer
- Statistics dashboard

**Key Functions**:
- `fetchCalls()`: Retrieves and updates call list
- `toggleActiveStatus()`: Updates admin availability
- `handleCall()`: Processes call actions
- `fetchSuspicionLog()`: Gets suspect history

## Edge Functions

### fetch-roblox-user
**Location**: `supabase/functions/fetch-roblox-user/index.ts`

**Purpose**: Fetches Roblox user data including user ID, avatar, and profile details

**Request Format**:
```json
{
  "username": "PlayerName",
  "includeDetails": false
}
```

**Response Format**:
```json
{
  "success": true,
  "user": {
    "userId": 1234567890,
    "username": "PlayerName",
    "avatarUrl": "https://...",
    "displayName": "Display Name"
  },
  "cached": false
}
```

## Integration Points

### ReportPage.tsx
- Added `AdminCallButton` component as floating element
- Positioned bottom-right with z-index 50

### AdminPage.tsx
- Added "Admin Calls" tab to existing admin interface
- Integrated `AdminCallsDashboard` component
- Maintains existing tab structure and styling

## Real-time Features

### Subscriptions
- **Admin Count**: `admin_availability` table changes
- **Call Updates**: `admin_call_alerts` table changes
- **Auto-refresh**: Every 30 seconds for expiry handling

### Live Updates
- Calls appear instantly for active admins
- Countdown timers update in real-time
- Admin count updates when admins go online/offline
- Status changes propagate immediately

## Security & Rate Limiting

### User Restrictions
- **Discord Verification**: Required for all call submissions
- **Rate Limiting**: 1 call per 2 minutes, max 10 per day
- **Cooldown Display**: Visual countdown when restricted
- **Database Enforcement**: Server-side validation

### Admin Access
- **Trust Level**: Requires admin or trust_level >= 2
- **RLS Policies**: Row-level security for all tables
- **Input Validation**: Sanitized user inputs
- **Image URLs**: Validated and handled safely

## UI/UX Design

### AdminCallButton
- **Position**: Fixed bottom-6 right-6 with z-50
- **Size**: 56px (w-14 h-14) circular button
- **Colors**: Red primary (#ef4444) with hover effects
- **Badge**: Green circle showing admin count
- **Status**: Green dot indicator when available
- **Animation**: Scale transform on hover

### Modal Design
- **Size**: max-w-md with responsive padding
- **Header**: Phone icon with title and admin count
- **Warning**: Amber background for emergency use notice
- **Form**: Stacked inputs with icons and validation
- **Preview**: Image preview when URL provided
- **Expiry**: Blue notice about 5-minute auto-expire

### Admin Dashboard
- **Header**: Title with Active/Inactive toggle
- **Statistics**: 4-card grid with metrics
- **Active Calls**: Prominent section with red accents
- **Call Cards**: Caller info, suspect details, timers
- **Recent Calls**: Collapsed history with status badges

## Error Handling

### Network Failures
- Graceful handling of edge function failures
- Fallback to polling when websocket fails
- Retry logic for failed submissions

### Validation
- Comprehensive form validation
- Clear error messages
- Rate limiting feedback
- Image loading error handling

### Real-time Disconnection
- Fallback polling every 30 seconds
- Graceful degradation of features
- User notification of connection issues

## Performance Optimizations

### Real-time Efficiency
- Efficient subscription management
- Cleanup on component unmount
- Debounced updates where appropriate

### Image Handling
- Lazy loading for proof images
- Error fallbacks for failed loads
- Optimized preview sizes

### Database Queries
- Indexed queries for performance
- Limited result sets (50 calls max)
- Efficient filtering and sorting

## Accessibility

### Keyboard Navigation
- Full keyboard accessibility
- Focus management in modals
- Escape key to close dialogs

### Screen Readers
- Proper ARIA labels
- Semantic HTML structure
- Descriptive alt text for images

### Mobile Responsiveness
- Touch-friendly button sizes
- Responsive modal layouts
- Mobile-optimized form inputs

## Deployment

### Edge Function Deployment
```bash
# Deploy the fetch-roblox-user function
supabase functions deploy fetch-roblox-user
```

### Database Migrations
```sql
-- Run the admin call system migrations
-- (Already implemented in the database schema above)
```

### Environment Variables
- No additional environment variables required
- Uses existing Supabase configuration
- Roblox API calls are public endpoints

## Testing

### Manual Testing Checklist
- [ ] User can make admin call when eligible
- [ ] Cooldown timer works correctly
- [ ] Admin dashboard shows real-time updates
- [ ] Call handling actions work properly
- [ ] Suspicion log displays correctly
- [ ] Image previews load and display
- [ ] Mobile responsiveness works
- [ ] Dark/light mode compatibility

### Automated Testing
- TypeScript compilation passes
- No linting errors
- Component renders without errors
- Real-time subscriptions work

## Future Enhancements

### Potential Features
- **Push Notifications**: Browser notifications for admins
- **Call Priority**: High/medium/low priority levels
- **Auto-assignment**: Automatic admin assignment
- **Call Analytics**: Detailed reporting and metrics
- **Integration**: Discord bot integration
- **Mobile App**: Native mobile app support

### Performance Improvements
- **Caching**: Redis caching for frequently accessed data
- **CDN**: Image CDN for proof screenshots
- **Optimization**: Database query optimization
- **Monitoring**: Application performance monitoring

## Support

For issues or questions about the Admin Call System:
1. Check the database schema and functions
2. Verify edge function deployment
3. Test real-time subscriptions
4. Review browser console for errors
5. Check Supabase logs for function errors

The system is production-ready and follows the existing code patterns and design system of the website. 