# RP Migration System - Complete Documentation

## Overview

The RP Migration System is a comprehensive solution for transitioning Roblox Bedwars leaderboard tracking from username-based to user_id-based systems. This system handles username changes, data backfilling, and provides a complete admin interface for managing the migration process.

## 🏗️ Architecture

### Core Components

1. **Backend Infrastructure**
   - Supabase database with user_id columns
   - Edge function: `backfill-user-ids`
   - Database helper functions for migration
   - Username change detection and logging

2. **Migration Utilities**
   - `migrationCoordinator.ts` - Master coordination class
   - `migrationManager.ts` - Step-by-step migration execution
   - `usernameChangeManager.ts` - Username change detection and merging

3. **Admin Interface**
   - `MigrationDashboard.tsx` - Main dashboard with overview
   - `UsernameChangeCard.tsx` - Individual change management
   - `MigrationProgress.tsx` - Real-time progress tracking
   - `MigrationStats.tsx` - Comprehensive statistics

4. **Integration**
   - Admin route: `/admin/migration`
   - Navigation integration in AdminPage
   - Error boundaries and loading states

## 📋 Migration Steps

The system follows a 7-step migration process:

1. **Database Setup** ✅
   - Verify user_id columns exist
   - Check helper functions are available

2. **Backfill rp_changes Table**
   - Update existing records with user_id values
   - Batch processing with retry logic

3. **Backfill rp_changes_optimized Table**
   - Update optimized table with user_id values
   - Maintain data integrity

4. **Detect Username Changes**
   - Identify users who changed usernames
   - Calculate confidence scores
   - Log changes for review

5. **Review Username Changes**
   - Manual review of detected changes
   - Approve/reject with evidence
   - Bulk operations support

6. **Update Leaderboard Table**
   - Backfill leaderboard with user_id values
   - Ensure consistency across tables

7. **Verify Migration Completeness**
   - Final verification checks
   - Data integrity validation

## 🚀 Setup Instructions

### 1. Database Preparation

Ensure your Supabase database has the required schema:

```sql
-- Add user_id columns to existing tables
ALTER TABLE rp_changes ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE rp_changes_optimized ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- Create username_change_log table
CREATE TABLE IF NOT EXISTS username_change_log (
  id SERIAL PRIMARY KEY,
  old_username VARCHAR(255) NOT NULL,
  new_username VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  status VARCHAR(50) DEFAULT 'pending',
  evidence JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  merged_at TIMESTAMP,
  merged_by VARCHAR(255)
);
```

### 2. Edge Function Deployment

Deploy the `backfill-user-ids` edge function to Supabase:

```bash
supabase functions deploy backfill-user-ids
```

### 3. Component Installation

All migration components are included in the codebase:

- `src/components/admin/MigrationDashboard.tsx`
- `src/components/admin/UsernameChangeCard.tsx`
- `src/components/admin/MigrationProgress.tsx`
- `src/components/admin/MigrationStats.tsx`
- `src/lib/migrationCoordinator.ts`
- `src/lib/migrationManager.ts`
- `src/lib/usernameChangeManager.ts`

### 4. Route Configuration

The migration system is accessible at `/admin/migration` and integrated into the main admin dashboard.

## 🎯 Usage Guide

### Accessing the Migration System

1. Navigate to `/admin` (Admin Dashboard)
2. Click the "RP Migration" button in the header
3. Or directly visit `/admin/migration`

### Starting a Migration

1. **Review System Health**
   - Check database connectivity
   - Verify edge function availability
   - Ensure migration readiness

2. **Quick Actions**
   - **Start Migration**: Begin the full 7-step process
   - **Detect Changes**: Find username changes only
   - **Refresh Stats**: Update statistics
   - **Advanced**: Access advanced controls

3. **Monitor Progress**
   - Real-time progress tracking
   - Step-by-step visualization
   - Error handling and recovery

### Managing Username Changes

1. **Review Detected Changes**
   - Visual transition display (old → new)
   - Confidence score badges
   - Evidence details (RP difference, rank difference, timing)

2. **Individual Actions**
   - **Approve**: Merge the username change
   - **Reject**: Decline the change
   - **Expand**: View detailed evidence

3. **Bulk Operations**
   - Select multiple changes
   - Bulk approve/reject
   - Batch processing

### Understanding Confidence Scores

- **High (≥80%)**: Green badge, likely legitimate change
- **Medium (60-80%)**: Yellow badge, review recommended
- **Low (<60%)**: Red badge, manual review required

## 📊 Statistics and Monitoring

### Overview Cards
- **Migration Progress**: Overall completion percentage
- **Username Changes**: Number of detected changes
- **Processing**: Real-time processing statistics
- **System Status**: Current migration state

### Detailed Statistics
- **Table Completion**: Progress for each database table
- **Processing Metrics**: Records processed, updated, cached
- **Performance Metrics**: Success rates, batch efficiency
- **Error Rates**: Failed operations and recovery

### Real-time Updates
- Live progress bars
- Current step indicators
- Error notifications
- Completion celebrations

## 🔧 Advanced Features

### Batch Processing
- Configurable batch sizes
- Retry logic with exponential backoff
- Progress persistence across interruptions
- Error recovery and resumption

### Error Handling
- Comprehensive error logging
- User-friendly error messages
- Expandable error details
- Recovery suggestions

### Performance Optimization
- Caching of user_id lookups
- Batch API calls to Roblox
- Database connection pooling
- Memory-efficient processing

### Security Features
- Admin-only access control
- Audit logging of all operations
- Confirmation dialogs for destructive actions
- Input validation and sanitization

## 🛠️ Troubleshooting

### Common Issues

1. **Edge Function Errors**
   ```
   Error: Edge function 'backfill-user-ids' not found
   ```
   **Solution**: Deploy the edge function to Supabase

2. **Database Connection Issues**
   ```
   Error: Unable to connect to database
   ```
   **Solution**: Check Supabase credentials and network connectivity

3. **Low Success Rates**
   ```
   Warning: Success rate below 95%
   ```
   **Solution**: Review failed operations and check API rate limits

4. **Username Change Detection Issues**
   ```
   Error: No username changes detected
   ```
   **Solution**: Verify data exists and check detection criteria

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
REACT_APP_MIGRATION_DEBUG=true
```

### Recovery Procedures

1. **Abort Migration**
   - Use the "Abort Migration" button in advanced controls
   - Migration state is preserved for resumption

2. **Reset State**
   - Use "Reset State" to clear all migration data
   - Warning: This will lose progress

3. **Manual Recovery**
   - Check database logs for specific errors
   - Review edge function logs in Supabase dashboard
   - Contact system administrator for complex issues

## 📈 Performance Considerations

### Database Optimization
- Indexes on user_id columns
- Batch updates for efficiency
- Connection pooling
- Query optimization

### API Rate Limiting
- Respect Roblox API limits
- Implement exponential backoff
- Cache successful lookups
- Monitor API usage

### Memory Management
- Process records in batches
- Clear caches periodically
- Monitor memory usage
- Garbage collection optimization

## 🔒 Security Best Practices

### Access Control
- Admin-only access to migration system
- Session validation
- Role-based permissions
- Audit logging

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Secure API calls

### Monitoring
- Real-time security monitoring
- Suspicious activity detection
- Automated alerts
- Incident response procedures

## 🧪 Testing

### Unit Tests
```bash
npm test -- --testPathPattern=migration
```

### Integration Tests
- Test migration coordinator
- Verify database operations
- Check edge function responses
- Validate UI interactions

### Load Testing
- Test with large datasets
- Verify performance under load
- Check memory usage
- Monitor API rate limits

## 📚 API Reference

### Migration Coordinator

```typescript
// Start full migration
await migrationCoordinator.startFullMigration();

// Detect username changes
await migrationCoordinator.detectUsernameChanges();

// Merge username change
await migrationCoordinator.mergeUsernameChange(
  oldUsername: string,
  newUsername: string,
  userId: number
);

// Get statistics
const stats = await migrationCoordinator.getStatistics();
```

### Username Change Manager

```typescript
// Detect changes
const changes = await detectUsernameChanges();

// Merge changes
await mergeUsernameChange(oldUsername, newUsername, userId);

// Get statistics
const stats = await getUsernameChangeStatistics();
```

### Migration Manager

```typescript
// Execute step
await executeStep(stepId: string);

// Get progress
const progress = await getProgress();

// Abort migration
await abort();
```

## 🚀 Deployment

### Production Checklist

- [ ] Database schema updated
- [ ] Edge functions deployed
- [ ] Environment variables configured
- [ ] Admin access verified
- [ ] Backup procedures in place
- [ ] Monitoring configured
- [ ] Error handling tested
- [ ] Performance validated

### Environment Variables

```bash
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_MIGRATION_DEBUG=false
REACT_APP_ROBLOX_API_RATE_LIMIT=100
```

## 📞 Support

### Getting Help

1. **Documentation**: Review this README and component documentation
2. **Logs**: Check browser console and Supabase logs
3. **Community**: Post issues in the project repository
4. **Admin**: Contact system administrator for critical issues

### Contributing

1. Follow the existing code style
2. Add comprehensive tests
3. Update documentation
4. Submit pull requests with detailed descriptions

## 📝 Changelog

### Version 1.0.0
- Initial release of migration system
- Complete admin interface
- Real-time progress tracking
- Comprehensive error handling
- Username change detection and management

---

**Note**: This migration system is designed for production use with proper testing and validation. Always backup your data before running migrations and test thoroughly in a staging environment first. 