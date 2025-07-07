import { RPMigrationManager, MigrationProgress, MigrationCallbacks, MigrationOptions } from './migrationManager';
import { UsernameChangeManager, UsernameChangeData, UsernameChangeStatistics, BulkMergeResult } from './usernameChangeManager';

// TypeScript interfaces for the coordinator
export interface MigrationCoordinatorState {
  isRunning: boolean;
  currentStep: string;
  overallProgress: number;
  usernameChanges: UsernameChangeData[];
  statistics: UsernameChangeStatistics | null;
  lastError: string | null;
}

export interface MigrationCoordinatorCallbacks extends MigrationCallbacks {
  onUsernameChangesDetected?: (changes: UsernameChangeData[]) => void;
  onStatisticsUpdated?: (stats: UsernameChangeStatistics) => void;
  onStateChanged?: (state: MigrationCoordinatorState) => void;
}

/**
 * Migration Coordinator
 * Provides a unified interface for managing the complete migration process
 * Integrates migration manager and username change manager
 */
export class MigrationCoordinator {
  private migrationManager: RPMigrationManager;
  private usernameChangeManager: UsernameChangeManager;
  private callbacks: MigrationCoordinatorCallbacks;
  private state: MigrationCoordinatorState;

  constructor(callbacks: MigrationCoordinatorCallbacks = {}, options: MigrationOptions = {}) {
    this.callbacks = callbacks;
    this.migrationManager = new RPMigrationManager(this.createMigrationCallbacks(), options);
    this.usernameChangeManager = new UsernameChangeManager();
    
    this.state = {
      isRunning: false,
      currentStep: '',
      overallProgress: 0,
      usernameChanges: [],
      statistics: null,
      lastError: null
    };
  }

  /**
   * Create migration callbacks that integrate with the coordinator
   */
  private createMigrationCallbacks(): MigrationCallbacks {
    return {
      onProgress: (progress: MigrationProgress) => {
        this.state.currentStep = progress.stepId;
        this.state.overallProgress = progress.progress;
        this.state.lastError = progress.errors?.[0] || null;
        
        this.callbacks.onProgress?.(progress);
        this.callbacks.onStateChanged?.(this.getState());
      },
      
      onStepComplete: (stepId: string, result: any) => {
        this.state.lastError = null;
        
        // If username changes were detected, update the state
        if (stepId === 'detect-username-changes' && result && Array.isArray(result)) {
          this.state.usernameChanges = result;
          this.callbacks.onUsernameChangesDetected?.(result);
        }
        
        this.callbacks.onStepComplete?.(stepId, result);
        this.callbacks.onStateChanged?.(this.getState());
      },
      
      onStepFailed: (stepId: string, error: string) => {
        this.state.lastError = error;
        this.callbacks.onStepFailed?.(stepId, error);
        this.callbacks.onStateChanged?.(this.getState());
      },
      
      onLog: (message: string, level?: 'info' | 'warning' | 'error') => {
        this.callbacks.onLog?.(message, level);
      }
    };
  }

  /**
   * Start the complete migration process
   */
  async startFullMigration(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Migration is already running');
    }

    this.state.isRunning = true;
    this.state.lastError = null;
    this.callbacks.onStateChanged?.(this.getState());

    try {
      await this.migrationManager.runFullMigration();
      
      // After migration completes, refresh statistics
      await this.refreshStatistics();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      throw error;
    } finally {
      this.state.isRunning = false;
      this.callbacks.onStateChanged?.(this.getState());
    }
  }

  /**
   * Run a specific migration step
   */
  async runStep(stepId: string): Promise<any> {
    if (this.state.isRunning) {
      throw new Error('Migration is already running');
    }

    this.state.isRunning = true;
    this.state.lastError = null;
    this.callbacks.onStateChanged?.(this.getState());

    try {
      const result = await this.migrationManager.runStep(stepId);
      
      // If username changes were detected, update the state
      if (stepId === 'detect-username-changes' && result && Array.isArray(result)) {
        this.state.usernameChanges = result;
        this.callbacks.onUsernameChangesDetected?.(result);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      throw error;
    } finally {
      this.state.isRunning = false;
      this.callbacks.onStateChanged?.(this.getState());
    }
  }

  /**
   * Detect username changes
   */
  async detectUsernameChanges(): Promise<UsernameChangeData[]> {
    try {
      const changes = await this.usernameChangeManager.detectUsernameChanges();
      this.state.usernameChanges = changes;
      this.callbacks.onUsernameChangesDetected?.(changes);
      this.callbacks.onStateChanged?.(this.getState());
      return changes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Get unverified username changes
   */
  async getUnverifiedChanges(): Promise<UsernameChangeData[]> {
    try {
      const changes = await this.usernameChangeManager.getUnverifiedChanges();
      this.state.usernameChanges = changes;
      this.callbacks.onStateChanged?.(this.getState());
      return changes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Merge a single username change
   */
  async mergeUsernameChange(
    oldUsername: string, 
    newUsername: string, 
    userId: number,
    mergedBy: string = 'system'
  ): Promise<boolean> {
    try {
      const result = await this.usernameChangeManager.mergeUsernameChange(
        oldUsername, 
        newUsername, 
        userId, 
        mergedBy
      );
      
      // Refresh statistics after merge
      await this.refreshStatistics();
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Bulk merge multiple username changes
   */
  async bulkMergeChanges(changes: Array<{ old_username: string; new_username: string; user_id: number }>): Promise<BulkMergeResult> {
    try {
      const result = await this.usernameChangeManager.bulkMergeChanges(changes);
      
      // Refresh statistics after bulk merge
      await this.refreshStatistics();
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Refresh username change statistics
   */
  async refreshStatistics(): Promise<UsernameChangeStatistics> {
    try {
      const stats = await this.usernameChangeManager.getChangeStatistics();
      this.state.statistics = stats;
      this.callbacks.onStatisticsUpdated?.(stats);
      this.callbacks.onStateChanged?.(this.getState());
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Verify a username change
   */
  async verifyUsernameChange(change: UsernameChangeData): Promise<{ verified: boolean; confidence: number; reasons: string[] }> {
    try {
      return await this.usernameChangeManager.verifyUsernameChange(change);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Reject a username change
   */
  async rejectUsernameChange(
    oldUsername: string, 
    newUsername: string, 
    userId: number,
    reason: string = 'Manually rejected'
  ): Promise<boolean> {
    try {
      const result = await this.usernameChangeManager.rejectUsernameChange(
        oldUsername, 
        newUsername, 
        userId, 
        reason
      );
      
      // Refresh statistics after rejection
      await this.refreshStatistics();
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.lastError = errorMessage;
      this.callbacks.onStateChanged?.(this.getState());
      throw error;
    }
  }

  /**
   * Get current coordinator state
   */
  getState(): MigrationCoordinatorState {
    return { ...this.state };
  }

  /**
   * Get migration manager state
   */
  getMigrationState() {
    return this.migrationManager.getState();
  }

  /**
   * Check if migration is running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Abort the current migration
   */
  abort(): void {
    this.migrationManager.abort();
    this.state.isRunning = false;
    this.callbacks.onStateChanged?.(this.getState());
  }

  /**
   * Reset the coordinator state
   */
  reset(): void {
    this.migrationManager.reset();
    this.state = {
      isRunning: false,
      currentStep: '',
      overallProgress: 0,
      usernameChanges: [],
      statistics: null,
      lastError: null
    };
    this.callbacks.onStateChanged?.(this.getState());
  }

  /**
   * Get username changes from current state
   */
  getUsernameChanges(): UsernameChangeData[] {
    return [...this.state.usernameChanges];
  }

  /**
   * Get statistics from current state
   */
  getStatistics(): UsernameChangeStatistics | null {
    return this.state.statistics;
  }

  /**
   * Get the last error
   */
  getLastError(): string | null {
    return this.state.lastError;
  }

  /**
   * Update callbacks after initialization
   */
  setCallbacks(callbacks: MigrationCoordinatorCallbacks): void {
    this.callbacks = callbacks;
  }
}

// Export singleton instance for easy access
export const migrationCoordinator = new MigrationCoordinator(); 