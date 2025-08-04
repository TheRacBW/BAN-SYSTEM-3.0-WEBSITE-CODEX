# Report Restriction System

## Overview

The Report Restriction System allows administrators to manage user access to report submission functionality. This system prevents abuse by allowing admins to ban users from submitting reports or temporarily restrict them based on false reporting behavior.

## Features

### 🔒 Restriction Types
- **Warning**: A warning that doesn't prevent submission but serves as a notice
- **Temporary Ban**: Time-limited restriction (configurable duration)
- **Permanent Ban**: Permanent restriction from submitting reports

### 📊 User Statistics Tracking
- Total reports submitted
- False reports count
- False report rate calculation
- Last report timestamp

### 🛡️ Admin Management
- View all user report statistics
- Add/remove restrictions
- Monitor restriction effectiveness
- Bulk user management

## Database Schema

### Tables

#### `user_report_restrictions`
```sql
CREATE TABLE user_report_restrictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('warning', 'temp_ban', 'permanent_ban')),
  reason TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

#### `user_report_stats`
```sql
CREATE TABLE user_report_stats (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_reports_submitted INTEGER DEFAULT 0,
  false_reports_count INTEGER DEFAULT 0,
  last_report_at TIMESTAMP WITH TIME ZONE,
  false_report_rate DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Functions

#### `can_user_submit_reports(user_uuid UUID)`
Returns boolean indicating if user can submit reports based on active restrictions.

#### `add_user_restriction(user_uuid UUID, restriction_type TEXT, reason TEXT, expires_at TIMESTAMP)`
Adds a new restriction for a user.

#### `remove_user_restriction(restriction_id UUID)`
Removes a specific restriction.

#### `auto_restrict_false_reporters()`
Automatically restricts users who submit false reports based on configurable thresholds.

## Components

### 1. ReportRestrictionManager
**Location**: `src/components/admin/ReportRestrictionManager.tsx`

Main admin interface for managing report restrictions:
- View all users with report statistics
- Add new restrictions
- Remove existing restrictions
- Monitor restriction effectiveness

**Features**:
- User statistics dashboard
- Restriction management modal
- Active restrictions list
- High-risk user identification

### 2. Enhanced AdminReportPanel
**Location**: `src/components/AdminReportPanel.tsx`

Enhanced report panel with user information and restriction capabilities:
- Submitter information display
- User statistics (reports submitted, false rate)
- Quick restriction actions
- Restriction history

**New Features**:
- Submitter info panel with Discord username
- Report statistics display
- One-click restriction addition
- Active restriction indicators

### 3. Enhanced UserPrivilegeEditor
**Location**: `src/components/admin/UserPrivilegeEditor.tsx`

Enhanced user management with report restriction capabilities:
- User report statistics
- Active restrictions display
- Add/remove restrictions
- Restriction history

### 4. useReportRestrictions Hook
**Location**: `src/hooks/useReportRestrictions.ts`

Custom hook for checking user report restrictions:
- Real-time restriction checking
- Restriction message generation
- Active restriction filtering

## Usage

### For Administrators

#### Adding Restrictions
1. Navigate to Admin Panel → Report Restrictions
2. Find the user in the statistics table
3. Click "Restrict" button
4. Choose restriction type and duration
5. Provide reason for restriction
6. Confirm action

#### Managing Existing Restrictions
1. View active restrictions in the restrictions table
2. Click "Remove" to lift a restriction
3. Monitor user behavior after restriction removal

#### User Management Integration
1. Go to User Management Panel
2. Select a user to edit
3. View their report statistics
4. Add/remove restrictions as needed

### For Users

#### Checking Restrictions
- Users automatically see restriction messages when trying to submit reports
- Clear messaging about restriction type and duration
- Expiration date display for temporary restrictions

#### Appeal Process
- Contact administrators through Discord
- Provide context for false positive cases
- Wait for admin review and decision

## Configuration

### Automatic Restriction Thresholds
The system automatically restricts users based on false report rates:

```sql
-- Users with >50% false report rate get temporary ban
-- Users with >70% false report rate get permanent ban
-- Multiple false reports in short time trigger warnings
```

### Restriction Durations
- **Warning**: No time limit (manual removal only)
- **Temporary Ban**: 1 hour to 1 year (configurable)
- **Permanent Ban**: No expiration (manual removal only)

## Security

### Row Level Security (RLS)
- Users can only view their own restrictions
- Admins can manage all restrictions
- Restriction data is protected by RLS policies

### Audit Trail
- All restrictions are logged with creator and timestamp
- Restriction history is maintained
- Admin actions are tracked

## Testing

### Manual Testing
1. Run the test script: `node test-report-restrictions.js`
2. Verify database functions work correctly
3. Test restriction flow in the UI
4. Verify restriction enforcement

### Test Scenarios
- [ ] Add temporary restriction
- [ ] Add permanent restriction
- [ ] Remove restriction
- [ ] Verify restriction enforcement
- [ ] Test automatic restriction triggers
- [ ] Verify restriction expiration

## Integration Points

### Report Submission Flow
1. User attempts to submit report
2. `useReportRestrictions` hook checks eligibility
3. If restricted, show restriction message
4. If allowed, proceed with submission

### Admin Call System
- Restricted users cannot make admin calls
- Integration with existing admin call restrictions
- Unified restriction management

### User Management
- Enhanced user profile with report statistics
- Quick restriction actions
- Historical restriction tracking

## Future Enhancements

### Planned Features
- [ ] Restriction appeal system
- [ ] Automatic restriction review
- [ ] Restriction templates
- [ ] Bulk restriction management
- [ ] Restriction analytics dashboard
- [ ] Email notifications for restrictions

### Potential Improvements
- [ ] Machine learning for false report detection
- [ ] Advanced restriction scheduling
- [ ] Restriction impact analysis
- [ ] User behavior prediction
- [ ] Automated restriction optimization

## Troubleshooting

### Common Issues

#### Restriction Not Applied
- Check if database functions exist
- Verify RLS policies are correct
- Ensure user has proper permissions

#### Restriction Not Expiring
- Check `cleanup_expired_restrictions()` function
- Verify timestamp format
- Check timezone settings

#### Statistics Not Updating
- Verify triggers are active
- Check `update_user_report_stats()` function
- Ensure proper error handling

### Debug Commands
```sql
-- Check active restrictions
SELECT * FROM user_report_restrictions WHERE expires_at > NOW() OR expires_at IS NULL;

-- Check user statistics
SELECT * FROM user_report_stats WHERE false_report_rate > 0.5;

-- Test restriction function
SELECT can_user_submit_reports('user-uuid-here');
```

## Support

For issues or questions about the report restriction system:
1. Check the troubleshooting section
2. Review database logs
3. Contact the development team
4. Submit a bug report with detailed information 