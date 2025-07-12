# Egress Optimizer - Database Cleanup System

## Overview

The Egress Optimizer is an automatic database cleanup system integrated into the admin dashboard's "RP Migration" page. It reduces Supabase egress costs by intelligently removing redundant historical data while preserving all meaningful RP changes and maintaining smooth leaderboard animations.

## Features

### 🧹 **Automatic Cleanup**
- **Hybrid Strategy**: Conservative cleanup for recent data (7 days), aggressive cleanup for old data
- **Surgical Position Sampling**: Keeps 4 samples per day (6-hour intervals) for position tracking
- **Preserves Meaningful Changes**: Maintains all RP/rank changes and anchor points for smooth animations
- **Cost Reduction**: Significantly reduces Supabase egress costs

### ⚙️ **Scheduling Options**
- **Manual Execution**: Run cleanup immediately with one click
- **Automatic Scheduling**: Set frequency (Daily, Every 2 Days, Every 3 Days, Weekly)
- **Browser-based Scheduler**: Uses setInterval for reliable scheduling
- **Next Run Display**: Shows countdown until next scheduled cleanup

### 📊 **Comprehensive Monitoring**
- **Real-time Results**: Immediate feedback on cleanup success/failure
- **Detailed Statistics**: Records removed, space saved, cost reduction estimates
- **Cleanup History**: Maintains audit trail of all cleanup operations
- **Error Handling**: Graceful error display with detailed logging

### 💾 **Data Persistence**
- **localStorage Storage**: Settings and history persist across browser sessions
- **History Management**: Keeps last 50 cleanup entries to prevent storage bloat
- **Settings Backup**: Automatic saving of scheduler preferences

## Database Function

### Function Name
```sql
egress_optimizer_comprehensive_enhanced_cleanup()
```

### Returns
Table with columns:
- `table_name`: Name of the table being cleaned
- `phase`: Cleanup phase (e.g., "Main Cleanup", "Position Sampling")
- `recent_before`: Records before cleanup (recent data)
- `recent_after`: Records after cleanup (recent data)
- `old_before`: Records before cleanup (old data)
- `old_after`: Records after cleanup (old data)
- `total_removed`: Total records removed
- `space_saved_mb`: Space saved in MB

### Example Response
```
table_name: "rp_changes"
phase: "Main Cleanup"
recent_before: 78021
recent_after: 78021
old_before: 6715
old_after: 2383
total_removed: 4332
space_saved_mb: 0.00
```

## UI Components

### Main Interface
- **Section Title**: "Automatic Egress Optimizer"
- **Description**: Explains the purpose and benefits
- **Status Indicator**: Shows if scheduler is active

### Quick Stats Cards
- **Last Cleanup**: Number of records removed in last run
- **Space Saved**: MB of storage space saved
- **Cost Reduction**: Estimated monthly cost savings

### Manual Controls
- **Run Cleanup Now**: Primary action button
- **Loading State**: Shows progress during execution
- **Success/Error Messages**: Immediate feedback

### Scheduler Controls
- **Enable/Disable**: Toggle automatic cleanup
- **Frequency Dropdown**: Select scheduling interval
- **Next Run Display**: Shows time until next execution

### Cleanup History
- **Timeline View**: Chronological list of cleanup operations
- **Status Indicators**: Success/error badges
- **Detailed Results**: Records removed and space saved per run
- **Error Details**: Full error messages for failed operations

## Technical Implementation

### Service Integration
```typescript
// Service function in leaderboardService.ts
export async function runEgressOptimizer(): Promise<any> {
  const { data, error } = await supabase.rpc('egress_optimizer_comprehensive_enhanced_cleanup');
  return data;
}
```

### Component Structure
```typescript
// Main component: EgressOptimizer.tsx
interface CleanupResult {
  table_name: string;
  phase: string;
  recent_before: number;
  recent_after: number;
  old_before: number;
  old_after: number;
  total_removed: number;
  space_saved_mb: number;
}

interface CleanupHistory {
  id: string;
  timestamp: string;
  results: CleanupResult[];
  totalRecordsRemoved: number;
  totalSpaceSaved: number;
  status: 'success' | 'error';
  error?: string;
}
```

### Scheduler Implementation
```typescript
// Browser-based scheduling using setInterval
const getIntervalMs = () => {
  switch (schedulerSettings.frequency) {
    case 'daily': return 24 * 60 * 60 * 1000;
    case 'every_2_days': return 2 * 24 * 60 * 60 * 1000;
    case 'every_3_days': return 3 * 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
};
```

## Integration Points

### Admin Dashboard
- **Location**: `/admin/migration` page
- **Position**: After Migration Progress section
- **Styling**: Consistent with existing admin dashboard design

### Navigation
- **Access**: Via "RP Migration" button in admin dashboard
- **Context**: Part of the comprehensive migration system

### Error Handling
- **Service Level**: Comprehensive error catching and logging
- **UI Level**: User-friendly error messages with retry options
- **Persistence**: Error history maintained for audit purposes

## Benefits

### Cost Reduction
- **Egress Optimization**: Reduces data transfer costs
- **Storage Efficiency**: Removes redundant historical data
- **Performance**: Faster queries on cleaned datasets

### Data Integrity
- **Preserves Changes**: Maintains all meaningful RP/rank changes
- **Position Tracking**: Keeps 6-hour resolution for smooth animations
- **Anchor Points**: Preserves critical data points for analysis

### User Experience
- **Intuitive Interface**: Easy-to-use controls for non-technical users
- **Real-time Feedback**: Immediate results and status updates
- **Comprehensive Monitoring**: Full audit trail and statistics

## Usage Guide

### For Administrators

1. **Access the Feature**
   - Navigate to Admin Dashboard (`/admin`)
   - Click "RP Migration" button
   - Scroll to "Automatic Egress Optimizer" section

2. **Manual Cleanup**
   - Click "Run Cleanup Now" button
   - Wait for completion (usually 30-60 seconds)
   - Review results in the success message

3. **Set Up Automatic Scheduling**
   - Check "Enable automatic cleanup"
   - Select frequency from dropdown
   - Monitor "Next run" display for timing

4. **Monitor Results**
   - Review "Cleanup History" section
   - Check "Quick Stats" for recent performance
   - Use "Cost Reduction" estimate for budgeting

### Best Practices

1. **Initial Setup**
   - Run manual cleanup first to establish baseline
   - Review results before enabling automatic scheduling
   - Start with weekly frequency and adjust as needed

2. **Monitoring**
   - Check cleanup history regularly
   - Monitor cost reduction estimates
   - Review error logs if issues occur

3. **Maintenance**
   - Cleanup history is automatically trimmed to last 50 entries
   - Settings persist across browser sessions
   - No additional maintenance required

## Troubleshooting

### Common Issues

1. **Function Not Found**
   - Ensure `egress_optimizer_comprehensive_enhanced_cleanup()` function exists in database
   - Check Supabase RPC permissions

2. **Scheduler Not Working**
   - Verify browser supports setInterval
   - Check if page is kept open for scheduled runs
   - Review browser console for errors

3. **No Results Displayed**
   - Check if cleanup actually ran (review history)
   - Verify database function returned data
   - Check browser console for errors

### Error Recovery

1. **Failed Cleanup**
   - Review error message in history
   - Check database connectivity
   - Verify function permissions

2. **Scheduler Issues**
   - Disable and re-enable automatic scheduling
   - Refresh page to reset scheduler
   - Check browser console for errors

## Future Enhancements

### Planned Features
- **Server-side Cron Jobs**: Replace browser-based scheduling
- **Email Notifications**: Alert administrators of cleanup results
- **Advanced Analytics**: Detailed cost savings analysis
- **Custom Schedules**: More granular scheduling options

### Potential Improvements
- **Real-time Monitoring**: Live dashboard of cleanup progress
- **Selective Cleanup**: Target specific tables or time ranges
- **Backup Verification**: Ensure data integrity before cleanup
- **Performance Metrics**: Track cleanup impact on system performance

## Security Considerations

### Data Safety
- **Read-only Function**: Cleanup function only removes redundant data
- **Preservation Logic**: Critical data points are preserved
- **Audit Trail**: All operations are logged for review

### Access Control
- **Admin Only**: Feature restricted to admin users
- **Function Permissions**: Database function requires proper permissions
- **Error Handling**: Sensitive information is not exposed in errors

## Conclusion

The Egress Optimizer provides a comprehensive solution for reducing Supabase costs while maintaining data integrity and user experience. Its integration into the existing admin dashboard makes it easily accessible to administrators while providing powerful automation capabilities.

The system balances cost reduction with data preservation, ensuring that the leaderboard system continues to function smoothly while optimizing database usage and reducing operational costs. 