# Admin Report Panel System

A comprehensive anti-cheat violation reporting system for your React/TypeScript website with Supabase backend.

## Features

### User Report Submission
- **Discord Verification Required**: Only Discord-verified users can submit reports
- **Anti-Spam Protection**: Simple captcha + rate limiting via database triggers
- **Evidence Requirements**:
  - YouTube/Medal video link (required, with embedded preview)
  - Match history image link (required, with preview)
  - Up to 5 Roblox players via username/ID lookup
  - Primary suspect highlighting for multiple players
  - Video timestamp tagging with YouTube deep links
- **Report Reasons**: Hacking/exploiting, queue dodging, glitch abusing, alt farming, hate speech, hate building
- **Automatic Restrictions**: Users with high false report rates get temp banned

### Admin Case Management
- **Role-Based Access**: Admins and AC mods (trust_level >= 2) only
- **Advanced Filtering**: Status, reason, date range, search, sorting
- **Case Statuses**: Not reviewed, under review, needs evidence, need another AC mod, solved (banned/not banned), insufficient evidence, invalid
- **Case Flags**: Needs replay, suspected alt, low evidence, high priority, etc.
- **Rich Case Details**: Embedded YouTube videos, image previews, player info with avatars
- **Timeline Management**: Clickable timestamp links that jump to specific video moments
- **Review System**: Full case notes, status updates, flag management

### Core Features
- **Real-time Statistics**: Dashboard showing case counts by status
- **YouTube Integration**: Video embedding and timestamp deep-linking
- **Roblox Player Search**: Integration with existing roblox user lookup functions
- **Automated Workflows**: Auto-restriction for repeat false reporters
- **Case History**: Full audit trail of status changes and reviews
- **Responsive Design**: Works on desktop and mobile following current theme

## Setup Instructions

### 1. Database Setup

Run the SQL schema in your Supabase SQL editor:

```sql
-- Copy and paste the contents of database/admin_report_schema.sql
-- into your Supabase SQL editor and execute
```

This will create:
- `admin_report_cases` - Main reports table
- `user_report_restrictions` - User restriction tracking
- `user_report_stats` - Automatic false report tracking
- All necessary RLS policies, triggers, and helper functions

### 2. Component Integration

The system has been integrated into your existing codebase:

#### New Components Created:
- `src/components/AdminReportPanel.tsx` - Main admin interface
- `src/components/ReportSubmissionForm.tsx` - User report form
- `src/pages/ReportPage.tsx` - Report submission page

#### Modified Files:
- `src/App.tsx` - Added `/report` route
- `src/pages/AdminPage.tsx` - Added tabbed interface with report panel
- `src/components/Header.tsx` - Added report link for authenticated users

### 3. Environment Requirements

Ensure your Supabase environment has:
1. The `roblox-status` function deployed (for player lookups)
2. The `find-user-id` function deployed (for player search)
3. Proper RLS policies enabled
4. Discord webhook URL configured (if using notifications)

### 4. Usage

#### For Users:
1. Navigate to `/report` or click the Flag icon in the header
2. Verify Discord account if not already verified
3. Fill out the report form with:
   - Violation type
   - YouTube video evidence
   - Video timestamps
   - Match history image
   - Reported players (up to 5)
   - Primary suspect selection
4. Complete captcha verification
5. Submit report

#### For Admins:
1. Navigate to `/admin`
2. Click the "Report Panel" tab
3. Use filters to find specific cases
4. Click "Review Case" to open detailed view
5. Update status, add flags, and write review notes
6. Save changes

## Database Schema

### Main Tables

#### `admin_report_cases`
- Stores all report submissions
- Includes evidence, player data, timestamps
- Tracks review status and admin notes

#### `user_report_restrictions`
- Tracks user bans/warnings for false reporting
- Supports temporary and permanent restrictions
- Automatic expiration handling

#### `user_report_stats`
- Automatic tracking of user report statistics
- Calculates false report rates
- Triggers auto-restrictions for problematic users

### Key Functions

#### `can_user_submit_reports(user_uuid)`
- Checks if user is allowed to submit reports
- Considers active restrictions and false report history

#### `update_user_report_stats()`
- Automatically updates user statistics on report submission
- Triggered on INSERT to admin_report_cases

#### `update_false_report_count()`
- Increments false report count when report marked invalid
- Updates false report rate calculations

#### `auto_restrict_false_reporters()`
- Automatically restricts users with high false report rates
- 60%+ false rate = 3 day ban
- 80%+ false rate = 7 day ban

## Security Features

### Row Level Security (RLS)
- Users can only view their own reports
- Admins can view and manage all reports
- Proper access control for restrictions and stats

### Rate Limiting
- Maximum 5 players per report
- Captcha verification required
- Automatic restrictions for false reporters

### Data Validation
- Required fields validation
- YouTube URL format validation
- Timestamp format validation
- Player search validation

## Customization

### Adding New Report Reasons
1. Update the `reason` CHECK constraint in the database
2. Add the new reason to `reasonOptions` in `ReportSubmissionForm.tsx`
3. Add the label to `reasonLabels` in `AdminReportPanel.tsx`

### Modifying Status Options
1. Update the `status` CHECK constraint in the database
2. Add new status to `statusConfig` in `AdminReportPanel.tsx`
3. Update any status-dependent logic

### Changing Auto-Restriction Rules
Modify the `auto_restrict_false_reporters()` function in the database:
```sql
-- Example: Change 60% threshold to 50%
IF current_false_rate >= 0.5 AND NOT restriction_exists THEN
  INSERT INTO user_report_restrictions (...)
```

## Troubleshooting

### Common Issues

#### "Player not found" errors
- Ensure the `find-user-id` function is deployed in Supabase
- Check that the function accepts both username and userId parameters

#### Permission denied errors
- Verify RLS policies are properly configured
- Check that user has appropriate trust_level for admin access

#### YouTube video embedding issues
- Ensure the video URL is in correct format
- Check that the video is publicly accessible

#### Database function errors
- Verify all functions are created successfully
- Check that triggers are properly attached to tables

### Debug Mode

Enable debug logging by adding to your components:
```typescript
console.log('Debug info:', { user, isAdmin, canSubmit });
```

## Performance Considerations

### Database Indexes
The schema includes optimized indexes for:
- Status filtering
- Date range queries
- User-specific lookups
- False report rate calculations

### Caching Strategy
Consider implementing:
- Report count caching for admin dashboard
- User restriction status caching
- Player lookup result caching

### Rate Limiting
The system includes:
- Per-user report submission limits
- Automatic false report tracking
- Progressive restriction escalation

## Future Enhancements

### Planned Features
1. **Discord Webhook Integration**: Automatic notifications for new reports
2. **Bulk Actions**: Mass status updates for multiple reports
3. **Report Analytics**: Advanced statistics and trend analysis
4. **Mobile App Integration**: Native mobile reporting interface
5. **AI-Powered Detection**: Automatic violation detection from video evidence

### API Extensions
1. **REST API**: External access to report data
2. **Webhook Endpoints**: Real-time notifications
3. **Bulk Import**: Import reports from external systems
4. **Export Functionality**: Export reports for external analysis

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the database logs in Supabase
3. Verify all components are properly imported
4. Test with a fresh database setup

## License

This system is designed for your specific website and follows your existing code patterns and security requirements. 