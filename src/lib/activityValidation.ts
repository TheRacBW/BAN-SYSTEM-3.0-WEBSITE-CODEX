/**
 * Activity Data Validation Utilities
 * 
 * Validates activity data consistency and fixes common issues
 */

/**
 * Validates daily minutes against last seen timestamp
 */
export const validateDailyMinutes = (
  dailyMinutes: number,
  lastSeenTimestamp: string | null | undefined,
  accountName?: string
): { validatedMinutes: number; issues: string[] } => {
  const issues: string[] = [];
  let validatedMinutes = dailyMinutes;

  if (!lastSeenTimestamp) {
    // No last seen data, return as-is but note the issue
    if (dailyMinutes > 0) {
      issues.push(`Daily minutes (${dailyMinutes}) but no last seen timestamp`);
    }
    return { validatedMinutes, issues };
  }

  const lastSeen = new Date(lastSeenTimestamp);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check if last seen was before today
  if (lastSeen < todayStart) {
    if (dailyMinutes > 0) {
      issues.push(`${accountName || 'Account'}: Last seen ${lastSeen.toLocaleDateString()} but has ${dailyMinutes} minutes today`);
      validatedMinutes = 0; // Reset to 0 if last seen before today
    }
    return { validatedMinutes, issues };
  }

  // Check if daily minutes exceed time since last seen
  const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  if (dailyMinutes > minutesSinceLastSeen + 30) { // Allow 30 minute buffer
    issues.push(
      `${accountName || 'Account'}: Daily minutes (${Math.round(dailyMinutes)}) exceeds time since last seen (${Math.round(minutesSinceLastSeen)} min)`
    );
    validatedMinutes = Math.max(0, minutesSinceLastSeen);
  }

  // Cap at 12 hours per day
  if (validatedMinutes > 720) {
    issues.push(`${accountName || 'Account'}: Daily minutes capped from ${Math.round(validatedMinutes)} to 720 (12 hours)`);
    validatedMinutes = 720;
  }

  return { validatedMinutes: Math.round(validatedMinutes), issues };
};

/**
 * Validates aggregated activity data for multi-account players
 */
export const validateAggregatedActivity = (
  accounts: Array<{
    username?: string;
    status?: {
      dailyMinutesToday?: number;
      lastUpdated?: string | number;
      lastSeenTimestamp?: string;
      isOnline?: boolean;
      isInGame?: boolean;
      inBedwars?: boolean;
    };
  }>
): {
  validatedDailyMinutes: number;
  validatedAccounts: number;
  issues: string[];
  debugInfo: any;
} => {
  const issues: string[] = [];
  const accountValidations = [];

  // Validate each account
  for (const account of accounts) {
    const accountName = account.username || 'Unknown';
    const dailyMinutes = account.status?.dailyMinutesToday || 0;
    const lastSeen = account.status?.lastSeenTimestamp || 
      (typeof account.status?.lastUpdated === 'string' ? account.status.lastUpdated : 
       account.status?.lastUpdated ? new Date(account.status.lastUpdated).toISOString() : undefined);
    
    const validation = validateDailyMinutes(dailyMinutes, lastSeen, accountName);
    accountValidations.push({
      accountName,
      original: dailyMinutes,
      validated: validation.validatedMinutes,
      lastSeen,
      isOnline: account.status?.isOnline || account.status?.isInGame || account.status?.inBedwars,
      issues: validation.issues
    });
    
    issues.push(...validation.issues);
  }

  // Use maximum validated daily minutes (not sum)
  const validatedDailyMinutes = Math.max(
    ...accountValidations.map(v => v.validated),
    0
  );

  // Count accounts with valid activity data
  const validatedAccounts = accountValidations.filter(v => v.validated > 0).length;

  // Additional validation: Check for inconsistencies
  const onlineAccounts = accountValidations.filter(v => v.isOnline);
  const accountsWithActivity = accountValidations.filter(v => v.validated > 0);

  if (onlineAccounts.length === 0 && validatedDailyMinutes > 0) {
    const minutesSinceActivity = accountValidations
      .filter(v => v.lastSeen)
      .map(v => (Date.now() - new Date(v.lastSeen!).getTime()) / (1000 * 60))
      .sort((a, b) => a - b)[0];

    if (minutesSinceActivity > 60) { // More than 1 hour ago
      issues.push(`Player has ${validatedDailyMinutes} minutes today but no accounts online and last activity was ${Math.round(minutesSinceActivity)} minutes ago`);
    }
  }

  return {
    validatedDailyMinutes,
    validatedAccounts,
    issues,
    debugInfo: {
      accountValidations,
      totalOriginalMinutes: accountValidations.reduce((sum, v) => sum + v.original, 0),
      maxOriginalMinutes: Math.max(...accountValidations.map(v => v.original), 0),
      onlineAccounts: onlineAccounts.length,
      accountsWithActivity: accountsWithActivity.length
    }
  };
};

/**
 * Format validation issues for display
 */
export const formatValidationIssues = (issues: string[]): string => {
  if (issues.length === 0) return '';
  
  return `⚠️ Activity Data Issues:\n${issues.map(issue => `• ${issue}`).join('\n')}`;
};

/**
 * Detect if activity data seems suspicious
 */
export const detectSuspiciousActivity = (
  dailyMinutes: number,
  weeklyAverage: number,
  accounts: any[]
): { suspicious: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  // Check for unrealistic daily time
  if (dailyMinutes > 600) { // More than 10 hours
    reasons.push(`Extremely high daily time: ${Math.round(dailyMinutes)} minutes (${(dailyMinutes/60).toFixed(1)} hours)`);
  }

  // Check for impossible weekly average
  if (weeklyAverage > 480) { // More than 8 hours average per day
    reasons.push(`Unrealistic weekly average: ${Math.round(weeklyAverage)} minutes/day (${(weeklyAverage/60).toFixed(1)} hours/day)`);
  }

  // Check for inconsistent multi-account data
  const accountsWithActivity = accounts.filter(acc => (acc.status?.dailyMinutesToday || 0) > 0);
  if (accountsWithActivity.length > 1) {
    const totalOriginal = accounts.reduce((sum, acc) => sum + (acc.status?.dailyMinutesToday || 0), 0);
    if (totalOriginal > dailyMinutes * 1.5) {
      reasons.push(`Multi-account time inflation detected: accounts total ${totalOriginal} min but using ${dailyMinutes} min`);
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons
  };
};