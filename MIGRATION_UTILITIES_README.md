# RP Migration Utilities

A comprehensive set of utilities for managing the migration from username-based to user_id-based RP tracking in the Roblox Bedwars leaderboard system.

## Overview

The migration utilities provide a complete solution for orchestrating the migration process, managing username changes, and coordinating between the admin interface and backend services.

## Architecture

### Core Components

1. **`migrationManager.ts`** - Master coordinator for step-by-step migration execution
2. **`usernameChangeManager.ts`** - Utilities for detecting and managing username changes
3. **`migrationCoordinator.ts`** - Unified interface that integrates both managers

### Integration Points

- **Leaderboard Service**: Uses updated `leaderboardService.ts` functions
- **Admin Interface**: Provides callbacks for real-time progress updates
- **Supabase Backend**: Integrates with edge functions and database functions
- **Database Tables**: Works with `rp_changes`, `rp_changes_optimized`, `leaderboard`, `username_change_log`

## Migration Manager (`migrationManager.ts`)

### Key Features

#### **Step-by-Step Execution**
- **7-Step Process**: Database setup → Backfill tables → Detect changes → Review → Update → Verify
- **Real-time Progress**: Live progress tracking with detailed metrics
- **Error Recovery**: Retry logic with exponential backoff
- **Abort Support**: Graceful cancellation of running operations

#### **Batch Processing**
- **Configurable Batches**: Adjustable batch sizes for different table sizes
- **Progress Aggregation**: Combines progress from multiple batch operations
- **hasMore Handling**: Continues processing until all records are updated
- **Rate Limiting**: Respectful of API limits with built-in delays

#### **State Management**
- **Migration State**: Tracks current step, completed steps, failed steps
- **Progress Persistence**: Maintains state across page refreshes
- **Statistics Tracking**: Records processed, updated, cached, and API calls

### TypeScript Interfaces

```typescript
interface MigrationProgress {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentBatch?: number;
  totalBatches?: number;
  processedRecords?: number;
  updatedRecords?: number;
  fromCache?: number;
  fromApi?: number;
  failedRecords?: number;
  errors?: string[];
  estimatedTimeRemaining?: number;
  details?: any;
}

interface MigrationCallbacks {
  onProgress?: (progress: MigrationProgress) => void;
  onStepComplete?: (stepId: string, result: any) => void;
  onStepFailed?: (stepId: string, error: string) => void;
  onBatchProgress?: (result: BatchProcessingResult) => void;
  onLog?: (message: string, level?: 'info' | 'warning' | 'error') => void;
}
```

### Usage Example

```typescript
import { RPMigrationManager } from '../lib/migrationManager';

const migrationManager = new RPMigrationManager({
  onProgress: (progress) => {
    console.log(`Step ${progress.stepId}: ${progress.progress}%`);
  },
  onStepComplete: (stepId, result) => {
    console.log(`Step ${stepId} completed:`, result);
  }
}, {
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000
});

// Run full migration
await migrationManager.runFullMigration();

// Or run individual steps
await migrationManager.runStep('backfill-rp-changes');
await migrationManager.runStep('detect-username-changes');
```

## Username Change Manager (`usernameChangeManager.ts`)

### Key Features

#### **Detection & Verification**
- **Automatic Detection**: Identifies users who changed usernames
- **Confidence Scoring**: Calculates confidence levels for detected changes
- **Evidence Analysis**: Examines RP/rank differences and timing
- **Manual Verification**: Additional checks for suspicious changes

#### **Bulk Operations**
- **Single Merges**: Merge individual username changes
- **Bulk Merges**: Process multiple changes efficiently
- **Rejection Handling**: Reject changes with reasons
- **Statistics Tracking**: Comprehensive change statistics

#### **Database Integration**
- **Change Log**: Tracks all username change activities
- **Status Management**: Pending, verified, merged, rejected states
- **Audit Trail**: Complete history of all operations

### TypeScript Interfaces

```typescript
interface UsernameChangeData {
  old_username: string;
  new_username: string;
  user_id: number;
  confidence_score: number;
  evidence: {
    rp_difference?: number;
    rank_difference?: number;
    timing?: string;
    last_seen_old?: string;
    first_seen_new?: string;
  };
  status: 'pending' | 'verified' | 'merged' | 'rejected';
  created_at: string;
  merged_at?: string;
  merged_by?: string;
}

interface UsernameChangeStatistics {
  totalDetected: number;
  totalMerged: number;
  totalPending: number;
  totalRejected: number;
  averageConfidence: number;
  lastDetectionDate?: string;
  lastMergeDate?: string;
}
```

### Usage Example

```typescript
import { UsernameChangeManager } from '../lib/usernameChangeManager';

const usernameManager = new UsernameChangeManager();

// Detect username changes
const changes = await usernameManager.detectUsernameChanges();

// Get unverified changes with filters
const pendingChanges = await usernameManager.getUnverifiedChanges({
  status: 'pending',
  minConfidence: 0.7,
  limit: 50
});

// Merge a single change
await usernameManager.mergeUsernameChange('oldUser', 'newUser', 12345);

// Bulk merge multiple changes
const bulkResult = await usernameManager.bulkMergeChanges([
  { old_username: 'user1', new_username: 'user1_new', user_id: 123 },
  { old_username: 'user2', new_username: 'user2_new', user_id: 456 }
]);

// Get statistics
const stats = await usernameManager.getChangeStatistics();
```

## Migration Coordinator (`migrationCoordinator.ts`)

### Key Features

#### **Unified Interface**
- **Single Entry Point**: One coordinator for all migration operations
- **State Management**: Centralized state tracking
- **Callback Integration**: Unified callback system for UI updates
- **Error Handling**: Comprehensive error management

#### **Integration Layer**
- **Manager Coordination**: Orchestrates migration and username managers
- **State Synchronization**: Keeps all components in sync
- **Progress Aggregation**: Combines progress from multiple sources
- **Statistics Management**: Centralized statistics tracking

### TypeScript Interfaces

```typescript
interface MigrationCoordinatorState {
  isRunning: boolean;
  currentStep: string;
  overallProgress: number;
  usernameChanges: UsernameChangeData[];
  statistics: UsernameChangeStatistics | null;
  lastError: string | null;
}

interface MigrationCoordinatorCallbacks extends MigrationCallbacks {
  onUsernameChangesDetected?: (changes: UsernameChangeData[]) => void;
  onStatisticsUpdated?: (stats: UsernameChangeStatistics) => void;
  onStateChanged?: (state: MigrationCoordinatorState) => void;
}
```

### Usage Example

```typescript
import { MigrationCoordinator } from '../lib/migrationCoordinator';

const coordinator = new MigrationCoordinator({
  onProgress: (progress) => {
    // Update UI progress
  },
  onUsernameChangesDetected: (changes) => {
    // Update username changes UI
  },
  onStatisticsUpdated: (stats) => {
    // Update statistics UI
  },
  onStateChanged: (state) => {
    // Update overall state UI
  }
});

// Start full migration
await coordinator.startFullMigration();

// Or run individual operations
await coordinator.detectUsernameChanges();
await coordinator.mergeUsernameChange('old', 'new', 123);
await coordinator.refreshStatistics();

// Get current state
const state = coordinator.getState();
const changes = coordinator.getUsernameChanges();
const stats = coordinator.getStatistics();
```

## Integration with Admin Interface

### Callback Integration

The admin interface uses the coordinator's callbacks for real-time updates:

```typescript
// In MigrationInterface.tsx
const coordinator = new MigrationCoordinator({
  onProgress: (progress) => {
    updateMigrationStep(progress.stepId, {
      status: progress.status,
      progress: progress.progress,
      error: progress.errors?.[0]
    });
  },
  onUsernameChangesDetected: (changes) => {
    setUsernameChanges(changes);
  },
  onStatisticsUpdated: (stats) => {
    setMigrationStats(stats);
  }
});
```

### State Synchronization

The coordinator maintains synchronized state across all components:

```typescript
// Get current state
const state = coordinator.getState();

// Check if running
if (coordinator.isRunning()) {
  // Show progress indicators
}

// Handle errors
const error = coordinator.getLastError();
if (error) {
  // Display error message
}
```

## Error Handling

### Comprehensive Error Management

#### **Network Errors**
- **Automatic Retry**: Exponential backoff for failed requests
- **Timeout Handling**: Graceful handling of long-running operations
- **Rate Limiting**: Respectful of API limits

#### **Database Errors**
- **Connection Issues**: Handle Supabase connection problems
- **Function Errors**: Handle database function failures
- **Constraint Violations**: Handle data integrity issues

#### **Validation Errors**
- **Input Validation**: Validate parameters before processing
- **Data Integrity**: Check data consistency
- **User Feedback**: Clear error messages for users

### Recovery Strategies

```typescript
// Retry with exponential backoff
const result = await this.retryOperation(
  () => leaderboardService.triggerUserIdBackfill(table, batchSize),
  'backfill operation',
  3 // max retries
);

// Handle specific error types
try {
  await coordinator.runStep('backfill-rp-changes');
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle timeout specifically
  } else if (error.message.includes('rate limit')) {
    // Handle rate limiting
  } else {
    // Handle general errors
  }
}
```

## Performance Considerations

### Batch Processing Optimization

#### **Configurable Batch Sizes**
- **Small Tables**: Use smaller batches (50-100 records)
- **Large Tables**: Use larger batches (200-500 records)
- **Memory Management**: Balance between speed and memory usage

#### **Progress Tracking**
- **Real-time Updates**: Live progress during batch processing
- **Cumulative Statistics**: Track totals across multiple batches
- **Estimated Completion**: Calculate remaining time

#### **API Rate Limiting**
- **Built-in Delays**: Automatic delays between batches
- **Respectful Processing**: Don't overwhelm external APIs
- **Error Recovery**: Handle rate limit errors gracefully

### Memory Management

```typescript
// Process in chunks to avoid memory issues
const processInChunks = async (items: any[], chunkSize: number) => {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await processChunk(chunk);
    
    // Allow garbage collection
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};
```

## Security Considerations

### Admin Access Control

#### **Authentication Requirements**
- **Admin Only**: Restrict access to authorized users
- **Role-based Access**: Different permissions for different operations
- **Session Management**: Proper session handling

#### **Data Protection**
- **Read-only Operations**: Safe detection and review processes
- **Confirmation Dialogs**: Prevent accidental merges
- **Audit Logging**: Track all migration activities

### Input Validation

```typescript
// Validate username changes before processing
const validateUsernameChange = (change: UsernameChangeData) => {
  if (!change.old_username || !change.new_username) {
    throw new Error('Invalid username change data');
  }
  
  if (change.user_id <= 0) {
    throw new Error('Invalid user ID');
  }
  
  if (change.confidence_score < 0 || change.confidence_score > 1) {
    throw new Error('Invalid confidence score');
  }
};
```

## Monitoring and Logging

### Real-time Monitoring

#### **Progress Tracking**
- **Step Progress**: Individual step completion percentages
- **Overall Progress**: Complete migration progress
- **Batch Progress**: Real-time batch processing updates

#### **Performance Metrics**
- **Processing Rates**: Records processed per second
- **Success Rates**: Percentage of successful operations
- **Error Rates**: Frequency and types of errors

### Comprehensive Logging

```typescript
// Structured logging with levels
this.log('Starting migration step', 'info');
this.log('Batch processing completed', 'info');
this.log('Network timeout occurred', 'warning');
this.log('Critical error in migration', 'error');

// Log with context
this.log(`Processing batch ${batchNumber}/${totalBatches}`, 'info');
this.log(`Updated ${updatedCount} records in batch`, 'info');
```

## Testing

### Unit Testing

```typescript
// Test migration manager
describe('RPMigrationManager', () => {
  it('should run full migration successfully', async () => {
    const manager = new RPMigrationManager();
    await expect(manager.runFullMigration()).resolves.not.toThrow();
  });
  
  it('should handle errors gracefully', async () => {
    const manager = new RPMigrationManager();
    await expect(manager.runStep('invalid-step')).rejects.toThrow();
  });
});

// Test username change manager
describe('UsernameChangeManager', () => {
  it('should detect username changes', async () => {
    const manager = new UsernameChangeManager();
    const changes = await manager.detectUsernameChanges();
    expect(Array.isArray(changes)).toBe(true);
  });
});
```

### Integration Testing

```typescript
// Test coordinator integration
describe('MigrationCoordinator', () => {
  it('should coordinate migration and username changes', async () => {
    const coordinator = new MigrationCoordinator();
    await coordinator.startFullMigration();
    
    const state = coordinator.getState();
    expect(state.isRunning).toBe(false);
    expect(state.overallProgress).toBe(100);
  });
});
```

## Deployment Considerations

### Environment Configuration

#### **Development Environment**
- **Debug Logging**: Enable detailed logging
- **Small Batch Sizes**: Use smaller batches for testing
- **Mock Services**: Use mock services for testing

#### **Production Environment**
- **Optimized Batch Sizes**: Use larger batches for efficiency
- **Error Monitoring**: Comprehensive error tracking
- **Performance Monitoring**: Track processing times and success rates

### Database Considerations

#### **Migration Safety**
- **Backup Before Migration**: Always backup before major operations
- **Rollback Plan**: Have a plan to rollback if needed
- **Testing Environment**: Test migrations in staging first

#### **Performance Impact**
- **Off-peak Processing**: Run migrations during low-traffic periods
- **Batch Sizing**: Balance between speed and database load
- **Monitoring**: Monitor database performance during migration

## Future Enhancements

### Planned Features

#### **Advanced Scheduling**
- **Scheduled Migrations**: Run migrations at specific times
- **Incremental Updates**: Only process changed records
- **Background Processing**: Move heavy processing to background jobs

#### **Enhanced Monitoring**
- **Real-time Dashboards**: Live migration progress dashboards
- **Alert System**: Notifications for failures or completions
- **Performance Analytics**: Detailed performance metrics

#### **Advanced Username Change Detection**
- **Machine Learning**: Use ML for better change detection
- **Pattern Recognition**: Identify patterns in username changes
- **Confidence Improvements**: Better confidence scoring algorithms

### Performance Improvements

#### **Parallel Processing**
- **Multi-table Processing**: Process multiple tables simultaneously
- **Concurrent Operations**: Run independent operations in parallel
- **Distributed Processing**: Spread processing across multiple workers

#### **Caching Layer**
- **Result Caching**: Cache frequently accessed results
- **Progress Caching**: Cache progress for recovery
- **Statistics Caching**: Cache statistics for performance

## Contributing

### Development Guidelines

#### **Code Quality**
- **TypeScript**: Strict typing for all components
- **Error Handling**: Comprehensive error management
- **Documentation**: Clear documentation for all functions
- **Testing**: Unit and integration tests

#### **Performance**
- **Memory Efficiency**: Minimize memory usage
- **Processing Speed**: Optimize for speed where possible
- **API Efficiency**: Minimize API calls

#### **Security**
- **Input Validation**: Validate all inputs
- **Access Control**: Proper authentication and authorization
- **Data Protection**: Protect sensitive data

### Code Style

```typescript
// Consistent naming conventions
class RPMigrationManager {
  private state: MigrationState;
  private callbacks: MigrationCallbacks;
  
  async runStep(stepId: string): Promise<any> {
    // Clear, descriptive method names
  }
  
  private updateProgress(progress: MigrationProgress): void {
    // Private methods for internal operations
  }
}
```

## License

This migration utilities package is part of the BAN-SYSTEM-3.0-WEBSITE-CODEX project and follows the same licensing terms. 