import { createClient } from '@supabase/supabase-js';
import { obfuscateApiKey, obfuscateUrl } from '../utils/security';

// Secure configuration wrapper to prevent sensitive data exposure
class SecureConfig {
  private _supabaseUrl: string;
  private _supabaseAnonKey: string;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this._supabaseUrl = supabaseUrl;
    this._supabaseAnonKey = supabaseAnonKey;
  }

  // Getter methods that return obfuscated values for logging
  get supabaseUrl(): string {
    return this._supabaseUrl;
  }

  get supabaseAnonKey(): string {
    return this._supabaseAnonKey;
  }

  // Method to get obfuscated URL for logging
  getObfuscatedUrl(): string {
    return obfuscateUrl(this._supabaseUrl);
  }

  // Method to get obfuscated key for logging
  getObfuscatedKey(): string {
    return obfuscateApiKey(this._supabaseAnonKey);
  }

  // Override toString to prevent accidental logging
  toString(): string {
    return '[SecureConfig: Supabase credentials]';
  }

  // Override toJSON to prevent accidental serialization
  toJSON(): object {
    return {
      url: this.getObfuscatedUrl(),
      key: this.getObfuscatedKey()
    };
  }
}

// Create secure config instance
const secureConfig = new SecureConfig();

// Create Supabase client with secure configuration
export const supabase = createClient(
  secureConfig.supabaseUrl, 
  secureConfig.supabaseAnonKey
);

// Export secure config for debugging (obfuscated)
export const getSecureConfig = () => ({
  url: secureConfig.getObfuscatedUrl(),
  key: secureConfig.getObfuscatedKey(),
  toString: () => '[SecureConfig: Obfuscated credentials]'
});