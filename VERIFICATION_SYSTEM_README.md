# Page Verification Guard System

## Overview

The Page Verification Guard System provides comprehensive access control for the website based on user trust levels and verification status. It integrates with the Discord verification bot and supports a 5-tier trust level system.

## Trust Level System

### Trust Levels
- **0 (New)**: Basic access, limited features
- **0.5 (Discord Verified)**: Discord account verified and linked
- **1 (Paid Tracker Verified)**: Has paid tracker access and premium features
- **2 (Trusted)**: Can submit and edit content, auto-approval enabled
- **3 (Moderator)**: Can moderate users and submissions

### Verification Types
- **Discord Verification**: Links Discord account to website account
- **Paid Tracker Verification**: Confirms paid subscription status
- **Trust Level Progression**: Automatic advancement based on usage

## Components

### Core Components

#### `VerificationGuard`
- **Purpose**: Wraps page content and checks access
- **Usage**: `<VerificationGuard pagePath="/strategies"><PageContent /></VerificationGuard>`
- **Features**: Loading states, error handling, popup integration

#### `VerificationPopup`
- **Purpose**: Shows verification requirements and action buttons
- **Features**: Status comparison, Discord integration, clear instructions

#### `VerificationStatusBadge`
- **Purpose**: Displays user's current trust level with icons
- **Usage**: `<VerificationStatusBadge userStatus={userStatus} showDetails={true} />`

#### `UserVerificationDashboard`
- **Purpose**: Comprehensive verification status and progression
- **Usage**: `<UserVerificationDashboard userStatus={userStatus} />`

### Admin Components

#### `PageAccessControlManager`
- **Purpose**: Admin interface for managing page access controls
- **Features**: CRUD operations, bulk actions, search/filter

## Database Integration

### Tables Used
- `page_access_controls`: Defines access requirements for each page
- `user_verification_status`: View with comprehensive user verification data
- `users`: Base user data with trust levels
- `discord_verifications`: Discord account linking data

### Functions Used
- `check_user_page_access(user_uuid, page_path)`: Database function for access checking

## Protected Pages

### Discord Verification Required (Trust Level 0.5+)
- `/strategies` - Strategy creation and browsing
- `/strat-picker` - Strategy selection and management

### Paid Tracker Required (Trust Level 1+)
- `/tracker` - Player tracking and monitoring
- `/players` - Player management and tracking

### Trusted Status Required (Trust Level 2+)
- `/admin` - Administrative tools
- `/admin/migration` - Database migration tools

### Public Access (Trust Level 0+)
- `/` - Home page
- `/leaderboard` - Public leaderboard
- `/contact` - Contact form
- `/auth` - Authentication pages
- `/settings` - User settings

## Implementation Guide

### 1. Protect a Page
```typescript
import { VerificationGuard } from '../components/auth';

const MyPage = () => {
  return (
    <VerificationGuard pagePath="/my-page">
      <div>Protected content here</div>
    </VerificationGuard>
  );
};
```

### 2. Show User Status
```typescript
import { VerificationStatusBadge } from '../components/auth';

const Header = () => {
  const { userStatus } = usePageAccess('/');
  
  return (
    <div>
      <VerificationStatusBadge userStatus={userStatus} showDetails={true} />
    </div>
  );
};
```

### 3. Add to User Profile
```typescript
import { UserVerificationDashboard } from '../components/auth';

const SettingsPage = () => {
  const { userStatus } = usePageAccess('/settings');
  
  return (
    <div>
      <UserVerificationDashboard userStatus={userStatus} />
    </div>
  );
};
```

### 4. Admin Management
The `PageAccessControlManager` is integrated into the admin panel at `/admin` and provides:
- View all page access controls
- Edit minimum trust levels
- Toggle Discord/paid verification requirements
- Add new page restrictions
- Enable/disable controls

## Discord Integration

### Discord Server
- **URL**: https://discord.gg/zRwZS6pRZ3
- **Verification Command**: `/verify [email]`
- **Requirements**: Users must stay in server to maintain verification

### Verification Flow
1. User clicks "Join Discord & Verify" button
2. Opens Discord server in new tab
3. User uses `/verify [email]` command
4. Bot verifies email matches website account
5. User's trust level is updated to 0.5
6. Access is automatically granted

## User Experience

### Access Denied Flow
1. User tries to access protected page
2. `VerificationGuard` checks access
3. If denied, shows `VerificationPopup`
4. Popup displays current vs required status
5. Provides action buttons (Join Discord, Upgrade, Contact Admin)
6. User completes verification
7. Access is automatically granted

### Status Indicators
- **Header Badge**: Shows current trust level
- **Settings Dashboard**: Comprehensive verification status
- **Progress Tracking**: Visual trust level progression
- **Next Steps**: Actionable guidance for advancement

## Testing

### Test Cases
1. **New User (Trust Level 0)**
   - Can access public pages
   - Cannot access Discord-verified pages
   - Shows Discord verification popup

2. **Discord Verified User (Trust Level 0.5)**
   - Can access strategies pages
   - Cannot access paid tracker pages
   - Shows paid verification popup

3. **Paid Tracker User (Trust Level 1)**
   - Can access player tracking
   - Cannot access admin pages
   - Shows trusted status requirement

4. **Trusted User (Trust Level 2)**
   - Can access admin panel
   - Full access to all features

5. **Moderator (Trust Level 3)**
   - Highest level access
   - Can manage all content

### Admin Testing
1. **Page Access Control Management**
   - Create new page restrictions
   - Edit existing controls
   - Test bulk operations
   - Verify search/filter functionality

2. **User Management**
   - Update user trust levels
   - Verify Discord verification status
   - Test paid tracker verification

## Database Schema

### page_access_controls
```sql
CREATE TABLE page_access_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  description TEXT,
  min_trust_level NUMERIC(3,1) NOT NULL DEFAULT 0,
  requires_discord_verification BOOLEAN NOT NULL DEFAULT false,
  requires_paid_verification BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### user_verification_status (View)
```sql
CREATE VIEW user_verification_status AS
SELECT 
  u.id,
  u.username,
  u.email,
  u.trust_level,
  u.is_admin,
  u.discord_verified_at,
  dv.discord_id,
  dv.discord_username,
  dv.is_verified as is_discord_verified,
  CASE WHEN u.trust_level >= 1 THEN true ELSE false END as is_paid_tracker_verified,
  u.created_at,
  u.last_login
FROM users u
LEFT JOIN discord_verifications dv ON u.id = dv.user_id;
```

## Security Considerations

### Access Control
- All access checks happen server-side via database functions
- Client-side components are for UX only
- Trust levels are enforced at database level

### Data Protection
- User verification data is properly secured
- Discord integration uses secure OAuth flow
- Admin actions require appropriate trust levels

### Error Handling
- Comprehensive error states in all components
- Graceful fallbacks for missing data
- Clear user feedback for all actions

## Future Enhancements

### Planned Features
1. **Advanced Trust Level Logic**
   - Time-based progression
   - Activity-based advancement
   - Custom verification types

2. **Enhanced Admin Tools**
   - Trust level analytics
   - Verification rate tracking
   - Automated progression rules

3. **Integration Improvements**
   - Additional Discord features
   - Payment system integration
   - Third-party verification providers

## Troubleshooting

### Common Issues

1. **Access Not Updating**
   - Check Discord verification status
   - Verify database function calls
   - Clear browser cache

2. **Popup Not Showing**
   - Check page access controls exist
   - Verify user status loading
   - Check console for errors

3. **Admin Interface Issues**
   - Ensure user has trust level 2+
   - Check database permissions
   - Verify component imports

### Debug Tools
- Browser console logging
- Database query monitoring
- Component state inspection
- Network request tracking