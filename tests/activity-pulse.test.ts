import { describe, it, expect } from 'vitest';
import { 
  detectTimezoneFromActivity, 
  calculatePeakHours, 
  getTimePeriod,
  aggregatePlayerActivity 
} from '../src/lib/activityTracking';

describe('Activity Pulse System', () => {
  describe('detectTimezoneFromActivity', () => {
    it('should detect EST timezone from afternoon activity', () => {
      const activity = {
        '14': 60, // 2pm
        '15': 90, // 3pm
        '16': 75, // 4pm
        '17': 45  // 5pm
      };
      const timezone = detectTimezoneFromActivity(activity);
      expect(timezone).toBe('EST (US East)');
    });

    it('should detect PST timezone from evening activity', () => {
      const activity = {
        '17': 60, // 5pm
        '18': 90, // 6pm
        '19': 75, // 7pm
        '20': 45  // 8pm
      };
      const timezone = detectTimezoneFromActivity(activity);
      expect(timezone).toBe('PST (US West)');
    });

    it('should return unknown for insufficient data', () => {
      const activity = {};
      const timezone = detectTimezoneFromActivity(activity);
      expect(timezone).toBe('unknown');
    });
  });

  describe('calculatePeakHours', () => {
    it('should calculate peak hours from activity distribution', () => {
      const activity = {
        '14': 30, // 2pm
        '15': 60, // 3pm - peak
        '16': 45, // 4pm
        '17': 50, // 5pm
        '18': 20  // 6pm
      };
      const peakHours = calculatePeakHours(activity);
      expect(peakHours).toEqual({ start: 15, end: 17 });
    });

    it('should handle wrap-around hours', () => {
      const activity = {
        '22': 40, // 10pm
        '23': 60, // 11pm - peak
        '0': 50,  // 12am
        '1': 30   // 1am
      };
      const peakHours = calculatePeakHours(activity);
      expect(peakHours).toEqual({ start: 0, end: 0 });
    });

    it('should return null for insufficient data', () => {
      const activity = {};
      const peakHours = calculatePeakHours(activity);
      expect(peakHours).toBeNull();
    });
  });

  describe('getTimePeriod', () => {
    it('should return morning for 6-11am', () => {
      expect(getTimePeriod(6)).toBe('morning');
      expect(getTimePeriod(11)).toBe('morning');
    });

    it('should return afternoon for 12-4pm', () => {
      expect(getTimePeriod(12)).toBe('afternoon');
      expect(getTimePeriod(16)).toBe('afternoon');
    });

    it('should return evening for 5-9pm', () => {
      expect(getTimePeriod(17)).toBe('evening');
      expect(getTimePeriod(21)).toBe('evening');
    });

    it('should return night for 10pm-5am', () => {
      expect(getTimePeriod(22)).toBe('night');
      expect(getTimePeriod(0)).toBe('night');
      expect(getTimePeriod(5)).toBe('night');
    });
  });

  describe('aggregatePlayerActivity', () => {
    it('should aggregate multiple accounts correctly', () => {
      const accounts = [
        {
          id: '1',
          user_id: 123,
          username: 'user1',
          status: {
            isOnline: true,
            isInGame: false,
            inBedwars: false,
            dailyMinutesToday: 60,
            weeklyAverage: 45,
            activityTrend: 'increasing',
            preferredTimePeriod: 'afternoon',
            detectedTimezone: 'EST (US East)',
            peakHoursStart: 14,
            peakHoursEnd: 16,
            activityDistribution: { '14': 30, '15': 30 }
          }
        },
        {
          id: '2',
          user_id: 456,
          username: 'user2',
          status: {
            isOnline: false,
            isInGame: false,
            inBedwars: false,
            dailyMinutesToday: 30,
            weeklyAverage: 30,
            activityTrend: 'stable',
            preferredTimePeriod: 'evening',
            detectedTimezone: 'EST (US East)',
            peakHoursStart: 18,
            peakHoursEnd: 20,
            activityDistribution: { '18': 15, '19': 15 }
          }
        }
      ];

      const result = aggregatePlayerActivity(accounts);

      expect(result.totalDailyMinutes).toBe(90);
      expect(result.avgWeeklyAverage).toBe(37.5);
      expect(result.activityTrend).toBe('increasing');
      expect(result.preferredTimePeriod).toBe('evening');
      expect(result.detectedTimezone).toBe('EST (US East)');
      expect(result.isCurrentlyOnline).toBe(true);
    });

    it('should handle empty accounts array', () => {
      const result = aggregatePlayerActivity([]);
      
      expect(result.totalDailyMinutes).toBe(0);
      expect(result.avgWeeklyAverage).toBe(0);
      expect(result.activityTrend).toBe('stable');
      expect(result.preferredTimePeriod).toBe('unknown');
      expect(result.detectedTimezone).toBe('unknown');
      expect(result.isCurrentlyOnline).toBe(false);
    });
  });
}); 