import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase import
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
        not: vi.fn(() => ({
          select: vi.fn()
        }))
      }))
    }))
  }
}));

import {
  triggerDailyReset,
  triggerDataCleanup,
  setupScheduling,
  getSystemHealth,
  getActivityStats,
  checkMaintenanceNeeded,
  getManualSchedulingInstructions,
  type ActivityPulseHealth,
  type MaintenanceResult
} from '../src/lib/activityPulseMaintenance';

// Get the mocked supabase instance
const mockSupabase = vi.mocked(await import('../src/lib/supabase')).supabase;

describe('Activity Pulse Maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('triggerDailyReset', () => {
    it('should successfully trigger daily reset', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await triggerDailyReset();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily activity data reset completed successfully');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reset_daily_activity_data');
    });

    it('should handle errors during daily reset', async () => {
      const errorMessage = 'Database connection failed';
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: errorMessage }
      });

      const result = await triggerDailyReset();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to trigger daily reset');
      expect(result.error).toBe(errorMessage);
    });

    it('should handle exceptions during daily reset', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Network error'));

      const result = await triggerDailyReset();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error triggering daily reset');
      expect(result.error).toBe('Network error');
    });
  });

  describe('triggerDataCleanup', () => {
    it('should successfully trigger data cleanup', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await triggerDataCleanup();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Activity data cleanup completed successfully');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_activity_data');
    });

    it('should handle errors during data cleanup', async () => {
      const errorMessage = 'Permission denied';
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: errorMessage }
      });

      const result = await triggerDataCleanup();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to trigger data cleanup');
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('setupScheduling', () => {
    it('should successfully set up scheduling', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await setupScheduling();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Activity Pulse scheduling configured successfully');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('setup_activity_pulse_scheduling');
    });

    it('should handle errors during scheduling setup', async () => {
      const errorMessage = 'pg_cron not available';
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: errorMessage }
      });

      const result = await setupScheduling();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to set up scheduling');
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health data', async () => {
      const mockHealthData = {
        total_users: 150,
        active_today: 45,
        active_this_week: 120,
        reset_today: 150,
        inactive_week: 10,
        inactive_month: 5,
        avg_daily_minutes: 85.5,
        avg_weekly_minutes: 420.3
      };

      const mockSelect = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: mockHealthData,
          error: null
        })
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getSystemHealth();

      expect(result).toEqual({
        totalUsers: 150,
        activeToday: 45,
        activeThisWeek: 120,
        resetToday: 150,
        inactiveWeek: 10,
        inactiveMonth: 5,
        avgDailyMinutes: 85.5,
        avgWeeklyMinutes: 420.3
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_pulse_health');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    it('should handle errors when fetching system health', async () => {
      const mockSelect = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'View not found' }
        })
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getSystemHealth();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching system health:', { message: 'View not found' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('getActivityStats', () => {
    it('should return activity statistics', async () => {
      const mockData = [
        {
          daily_minutes_today: 120,
          weekly_average: 85.5,
          activity_trend: 'increasing',
          preferred_time_period: 'evening',
          detected_timezone: 'EST',
          last_updated: '2024-01-08T10:00:00Z'
        },
        {
          daily_minutes_today: 60,
          weekly_average: 45.2,
          activity_trend: 'stable',
          preferred_time_period: 'afternoon',
          detected_timezone: 'PST',
          last_updated: '2024-01-08T09:30:00Z'
        }
      ];

      const mockNot = vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      }));

      const mockSelect = vi.fn(() => ({
        not: mockNot
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getActivityStats();

      expect(result).toEqual({
        totalActive: 2,
        averageDailyMinutes: 90,
        averageWeeklyMinutes: 65.35,
        trendDistribution: {
          increasing: 1,
          stable: 1
        },
        timePeriodDistribution: {
          evening: 1,
          afternoon: 1
        },
        timezoneDistribution: {
          EST: 1,
          PST: 1
        }
      });
    });

    it('should handle empty data', async () => {
      const mockNot = vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }));

      const mockSelect = vi.fn(() => ({
        not: mockNot
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getActivityStats();

      expect(result).toEqual({
        totalActive: 0,
        averageDailyMinutes: 0,
        averageWeeklyMinutes: 0,
        trendDistribution: {},
        timePeriodDistribution: {},
        timezoneDistribution: {}
      });
    });
  });

  describe('checkMaintenanceNeeded', () => {
    it('should identify when maintenance is needed', async () => {
      const mockHealthData = {
        total_users: 100,
        active_today: 20,
        reset_today: 0,
        inactive_month: 15,
        avg_daily_minutes: 600
      };

      const mockSelect = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: mockHealthData,
          error: null
        })
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await checkMaintenanceNeeded();

      expect(result.needsReset).toBe(true);
      expect(result.needsCleanup).toBe(true);
      expect(result.recommendations).toContain('Daily reset needed - no users reset today');
      expect(result.recommendations).toContain('Cleanup recommended - 15 users inactive for 30+ days');
      expect(result.recommendations).toContain('High average daily minutes detected - consider investigating');
    });

    it('should return no maintenance needed when system is healthy', async () => {
      const mockHealthData = {
        total_users: 100,
        active_today: 50,
        reset_today: 100,
        inactive_month: 5,
        avg_daily_minutes: 120
      };

      const mockSelect = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: mockHealthData,
          error: null
        })
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await checkMaintenanceNeeded();

      expect(result.needsReset).toBe(false);
      expect(result.needsCleanup).toBe(false);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should handle errors when checking maintenance', async () => {
      const mockSelect = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await checkMaintenanceNeeded();

      expect(result.needsReset).toBe(false);
      expect(result.needsCleanup).toBe(false);
      expect(result.recommendations).toContain('Unable to fetch system health data');
    });
  });

  describe('getManualSchedulingInstructions', () => {
    it('should return scheduling instructions', () => {
      const instructions = getManualSchedulingInstructions();

      expect(instructions).toContain('Activity Pulse Manual Scheduling Instructions');
      expect(instructions).toContain('Daily Reset (Midnight):');
      expect(instructions).toContain('Weekly Cleanup (Sunday 2 AM):');
      expect(instructions).toContain('Using cron (Linux/macOS):');
      expect(instructions).toContain('Using Windows Task Scheduler:');
      expect(instructions).toContain('Using Supabase Edge Functions:');
      expect(instructions).toContain('Using external services (Zapier, IFTTT, etc.):');
    });
  });
}); 