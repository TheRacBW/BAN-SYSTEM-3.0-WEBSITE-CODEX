/**
 * Security utilities for obfuscating sensitive data
 */

// Patterns that match sensitive data
const SENSITIVE_PATTERNS = [
  /VITE_SUPABASE_URL/gi,
  /VITE_SUPABASE_ANON_KEY/gi,
  /supabase\.co/gi,
  /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, // JWT pattern
  /sk-[A-Za-z0-9]{48}/g, // Supabase service key pattern
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, // UUID pattern
];

/**
 * Obfuscate sensitive data in strings
 */
export function obfuscateSensitiveData(input: string): string {
  let result = input;
  SENSITIVE_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED]');
  });
  return result;
}

/**
 * Obfuscate an API key for safe logging
 */
export function obfuscateApiKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.substring(0, 8)}***`;
}

/**
 * Obfuscate a URL for safe logging
 */
export function obfuscateUrl(url: string): string {
  if (!url) return '***';
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}***`;
  } catch {
    return '***';
  }
}

/**
 * Create a secure logger that automatically obfuscates sensitive data
 */
export function createSecureLogger() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  const sanitizeArgs = (args: any[]): any[] => {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return obfuscateSensitiveData(arg);
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          const stringified = JSON.stringify(arg);
          const sanitized = obfuscateSensitiveData(stringified);
          return JSON.parse(sanitized);
        } catch {
          return arg;
        }
      }
      return arg;
    });
  };

  return {
    log: (...args: any[]) => originalLog.apply(console, sanitizeArgs(args)),
    warn: (...args: any[]) => originalWarn.apply(console, sanitizeArgs(args)),
    error: (...args: any[]) => originalError.apply(console, sanitizeArgs(args)),
    info: (...args: any[]) => originalInfo.apply(console, sanitizeArgs(args)),
  };
}

/**
 * Check if a string contains sensitive data
 */
export function containsSensitiveData(input: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Secure environment variable getter
 */
export function getSecureEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (!value) return '';
  
  // For sensitive keys, return obfuscated version
  if (key.includes('SUPABASE') || key.includes('API') || key.includes('KEY')) {
    return obfuscateApiKey(value);
  }
  
  return value;
}

/**
 * Initialize secure logging in development
 */
export function initializeSecureLogging() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const secureLogger = createSecureLogger();
    
    // Override console methods
    console.log = secureLogger.log;
    console.warn = secureLogger.warn;
    console.error = secureLogger.error;
    console.info = secureLogger.info;
    
    console.log('[Security] Secure logging initialized');
  }
} 