# RP System Migration Interface

A comprehensive React admin interface for managing the migration from username-based to user_id-based RP tracking in the Roblox Bedwars leaderboard system.

## Overview

The MigrationInterface component provides a complete solution for migrating the RP tracking system to handle Roblox username changes by using user_id as the primary identifier while maintaining backward compatibility.

## Features

### 🔄 **Migration Progress Tracking**
- **7-Step Migration Process**: Database setup → Backfill tables → Detect changes → Review → Update → Verify
- **Real-time Progress**: Live progress bars and status indicators for each step
- **Error Handling**: Comprehensive error reporting with retry capabilities
- **Status Persistence**: Progress maintained across page refreshes

### 👥 **Username Change Management**
- **Automatic Detection**: Identifies users who have changed their usernames
- **Confidence Scoring**: Shows confidence levels for detected changes
- **Evidence Display**: Shows RP/rank differences and timing evidence
- **Bulk Operations**: Select multiple changes for batch merging
- **Manual Review**: Approve changes before merging

### 📊 **Real-time Progress Tracking**
- **Batch Processing**: Real-time progress bars for large operations
- **Live Statistics**: Updated counts for processed, updated, cached, and API calls
- **Error Reporting**: Detailed error logs with context
- **Performance Metrics**: Success rates and estimated completion times

### 🎛️ **Migration Orchestration**
- **Full Migration**: One-click complete migration process
- **Individual Steps**: Execute specific steps independently
- **Progress Monitoring**: Real-time updates during processing
- **Logging System**: Comprehensive audit trail

## Component Structure

### Core Files
- `src/components/admin/MigrationInterface.tsx` - Main migration interface
- `src/pages/AdminMigrationPage.tsx` - Admin page wrapper
- `src/services/leaderboardService.ts` - Backend service integration

### TypeScript Interfaces

```typescript
interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
  details?: any;
}

interface UsernameChange {
  old_username: string;
  new_username: string;
  user_id: number;
  confidence_score: number;
  evidence: {
    rp_difference?: number;
    rank_difference?: number;
    timing?: string;
  };
  selected: boolean;
}

interface BatchProgress {
  processed: number;
  updated: number;
  fromCache: number;
  fromApi: number;
  failed: number;
  errors: string[];
  hasMore: boolean;
}
```

## Migration Steps

### 1. Database Setup ✅
- **Status**: Pre-completed
- **Description**: Verify user_id columns and helper functions
- **Action**: No action required

### 2. Backfill rp_changes Table
- **Purpose**: Update existing RP change records with user_id values
- **Process**: Batch processing with progress tracking
- **Dependencies**: Edge function 'backfill-user-ids'

### 3. Backfill rp_changes_optimized Table
- **Purpose**: Update optimized table with user_id values
- **Process**: Batch processing with progress tracking
- **Dependencies**: Edge function 'backfill-user-ids'

### 4. Detect Username Changes
- **Purpose**: Identify users who have changed their usernames
- **Process**: Database function call
- **Output**: List of detected changes with confidence scores

### 5. Review Username Changes
- **Purpose**: Manually review and approve detected changes
- **Process**: Manual selection and bulk merging
- **Features**: Evidence display, confidence scoring, bulk operations

### 6. Update Leaderboard Table
- **Purpose**: Backfill leaderboard table with user_id values
- **Process**: Batch processing with progress tracking
- **Dependencies**: Edge function 'backfill-user-ids'

### 7. Verify Migration Completeness
- **Purpose**: Run final verification checks
- **Process**: Validation and reporting
- **Output**: Migration completion status

## Usage

### Basic Integration

```tsx
import MigrationInterface from '../components/admin/MigrationInterface';

const AdminPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MigrationInterface />
    </div>
  );
};
```

### Accessing the Interface

1. Navigate to the admin migration page
2. Review the current migration status
3. Choose execution method:
   - **Full Migration**: Run all steps automatically
   - **Individual Steps**: Execute specific steps as needed

### Username Change Review Process

1. **Detection**: System automatically detects potential username changes
2. **Review**: Examine evidence and confidence scores
3. **Selection**: Choose changes to merge (bulk selection available)
4. **Merge**: Execute the merge operation
5. **Verification**: Confirm successful merging

## Backend Integration

### Required Supabase Setup

```sql
-- Edge function for backfilling user IDs
-- Endpoint: https://dhmenivfjwbywdutchdz.supabase.co/functions/v1/backfill-user-ids

-- Database functions for username change detection
SELECT detect_username_changes();
SELECT merge_username_change(p_old_username, p_new_username, p_user_id);
```

### Service Integration

The interface integrates with the updated `leaderboardService`:

```typescript
// Trigger backfill
await leaderboardService.triggerUserIdBackfill(table, batchSize, forceRefresh);

// Detect username changes
await leaderboardService.detectUsernameChanges();

// Merge username changes
await leaderboardService.mergeUsernameChanges();
```

## UI Components

### Progress Cards
- Status icons (pending, running, completed, failed)
- Progress bars with percentages
- Error display with retry options
- Step-specific action buttons

### Username Changes Panel
- Collapsible detailed view
- Bulk selection checkboxes
- Evidence display (RP/rank differences)
- Confidence score indicators
- Merge action buttons

### Batch Progress Display
- Real-time statistics (processed, updated, cached, API)
- Error log with expandable details
- Progress indicators for ongoing operations

### Migration Logs
- Timestamped log entries
- Expandable/collapsible view
- Real-time updates during processing

## Error Handling

### Comprehensive Error Management
- **Network Errors**: Automatic retry with exponential backoff
- **Database Errors**: Detailed error messages with context
- **Validation Errors**: User-friendly error descriptions
- **Timeout Handling**: Graceful handling of long-running operations

### Recovery Options
- **Step Retry**: Retry individual failed steps
- **Full Reset**: Reset all progress and start fresh
- **Partial Migration**: Continue from last successful step

## Performance Considerations

### Batch Processing
- **Configurable Batch Sizes**: Adjustable for different table sizes
- **Progress Tracking**: Real-time updates during processing
- **Memory Management**: Efficient handling of large datasets
- **API Rate Limiting**: Respectful of external API limits

### UI Performance
- **Virtual Scrolling**: For large lists of username changes
- **Debounced Updates**: Prevent excessive re-renders
- **Optimistic Updates**: Immediate UI feedback
- **Background Processing**: Non-blocking operations

## Security Considerations

### Admin Access Control
- **Authentication Required**: Ensure only authorized users can access
- **Role-based Access**: Restrict to admin users only
- **Audit Logging**: Track all migration activities

### Data Protection
- **Read-only Operations**: Safe detection and review processes
- **Confirmation Dialogs**: Prevent accidental merges
- **Backup Recommendations**: Suggest backups before major operations

## Monitoring and Logging

### Real-time Monitoring
- **Progress Tracking**: Live updates during operations
- **Performance Metrics**: Processing rates and success rates
- **Error Tracking**: Comprehensive error logging
- **Completion Notifications**: Success/failure alerts

### Audit Trail
- **Timestamped Logs**: All actions logged with timestamps
- **User Attribution**: Track who performed which actions
- **Change History**: Record all modifications made
- **Export Capability**: Download logs for analysis

## Troubleshooting

### Common Issues

1. **Edge Function Timeouts**
   - Solution: Reduce batch size or implement pagination
   - Monitor: Check function execution logs

2. **Database Connection Issues**
   - Solution: Verify Supabase connection and permissions
   - Monitor: Check network connectivity

3. **Username Change Detection Failures**
   - Solution: Verify database functions are properly installed
   - Monitor: Check function return values

4. **Progress Not Updating**
   - Solution: Check React state management and re-renders
   - Monitor: Verify callback dependencies

### Debug Mode

Enable detailed logging by adding debug flags:

```typescript
// Add to component for enhanced logging
const DEBUG_MODE = process.env.NODE_ENV === 'development';
```

## Future Enhancements

### Planned Features
- **Scheduled Migrations**: Run migrations at specific times
- **Rollback Capability**: Undo migration changes if needed
- **Advanced Filtering**: Filter username changes by criteria
- **Export/Import**: Backup and restore migration state
- **Multi-environment Support**: Support for staging/production

### Performance Improvements
- **Parallel Processing**: Process multiple tables simultaneously
- **Incremental Updates**: Only process changed records
- **Caching Layer**: Cache frequently accessed data
- **Background Jobs**: Move heavy processing to background

## Contributing

### Development Guidelines
- **TypeScript**: Strict typing for all components
- **Testing**: Unit tests for all functions
- **Documentation**: Comprehensive JSDoc comments
- **Error Handling**: Graceful error management
- **Accessibility**: WCAG 2.1 compliance

### Code Style
- **Consistent Formatting**: Prettier configuration
- **Linting**: ESLint rules enforcement
- **Component Structure**: Consistent file organization
- **Naming Conventions**: Clear and descriptive names

## License

This component is part of the BAN-SYSTEM-3.0-WEBSITE-CODEX project and follows the same licensing terms. 