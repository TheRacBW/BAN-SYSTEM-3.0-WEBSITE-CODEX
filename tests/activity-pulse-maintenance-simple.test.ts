import { describe, it, expect } from 'vitest';
import { getManualSchedulingInstructions } from '../src/lib/activityPulseMaintenance';

describe('Activity Pulse Maintenance - Simple Tests', () => {
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
      expect(instructions).toContain('Monitoring:');
    });

    it('should contain specific cron commands', () => {
      const instructions = getManualSchedulingInstructions();
      
      expect(instructions).toContain('0 0 * * *');
      expect(instructions).toContain('0 2 * * 0');
      expect(instructions).toContain('SELECT reset_daily_activity_data();');
      expect(instructions).toContain('SELECT cleanup_activity_data();');
    });

    it('should provide multiple scheduling options', () => {
      const instructions = getManualSchedulingInstructions();
      
      const options = [
        'cron (Linux/macOS)',
        'Windows Task Scheduler',
        'Supabase Edge Functions',
        'external services (Zapier, IFTTT, etc.)'
      ];
      
      options.forEach(option => {
        expect(instructions).toContain(option);
      });
    });
  });
}); 