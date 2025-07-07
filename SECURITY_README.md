# Security Features

This project includes comprehensive security measures to prevent sensitive data exposure in the browser console and logs.

## 🔒 Implemented Security Features

### 1. Secure Configuration Wrapper
- **Location**: `src/lib/supabase.ts`
- **Purpose**: Wraps Supabase credentials in a secure class that prevents accidental logging
- **Features**:
  - Obfuscated URL and API key getters
  - Custom `toString()` and `toJSON()` methods
  - Prevents direct access to raw credentials

### 2. Console Logging Protection
- **Location**: `src/utils/security.ts`
- **Purpose**: Automatically sanitizes console output in development
- **Features**:
  - Overrides `console.log`, `console.warn`, `console.error`, `console.info`
  - Detects and redacts sensitive patterns
  - Only active in development mode

### 3. Sensitive Data Detection
- **Patterns Detected**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `supabase.co` URLs
  - JWT tokens (eyJ...)
  - Supabase service keys (sk-...)
  - UUID patterns

### 4. Obfuscation Utilities
- **API Keys**: Shows first 8 characters + `***`
- **URLs**: Shows protocol + hostname + `***`
- **General**: Replaces sensitive patterns with `[REDACTED]`

## 🛡️ How It Works

### Automatic Initialization
```typescript
// src/main.tsx
import { initializeSecureLogging } from './utils/security';
initializeSecureLogging();
```

### Secure Configuration
```typescript
// src/lib/supabase.ts
const secureConfig = new SecureConfig();
export const supabase = createClient(
  secureConfig.supabaseUrl, 
  secureConfig.supabaseAnonKey
);
```

### Console Protection
```typescript
// Any console.log with sensitive data is automatically sanitized
console.log('API Key:', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
// Output: API Key: eyJhbGci***
```

## 🔧 Usage

### For Development
- Sensitive data is automatically obfuscated in console output
- No additional configuration needed
- Works transparently with existing code

### For Debugging
```typescript
import { getSecureConfig } from '../lib/supabase';

// Get obfuscated config for debugging
const config = getSecureConfig();
console.log(config); // Shows obfuscated values
```

### For Custom Logging
```typescript
import { obfuscateApiKey, obfuscateUrl } from '../utils/security';

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const url = 'https://dhmenivfjwbywdutchdz.supabase.co';

console.log('Key:', obfuscateApiKey(apiKey)); // eyJhbGci***
console.log('URL:', obfuscateUrl(url)); // https://dhmenivfjwbywdutchdz.supabase.co***
```

## 🚨 Security Best Practices

### Environment Variables
- Never log raw environment variables
- Use obfuscation utilities for debugging
- Keep sensitive data out of client-side code when possible

### Console Logging
- Avoid logging sensitive data directly
- Use the provided obfuscation utilities
- Be mindful of what gets logged in production

### Error Handling
- Ensure error messages don't expose sensitive data
- Use generic error messages for security-related failures
- Log security events appropriately

## 🔍 Testing Security

### Verify Obfuscation
1. Open browser console (F12)
2. Check that sensitive data is not visible
3. Verify that obfuscated values are shown instead

### Test Patterns
```typescript
// These should be redacted in console output
console.log('VITE_SUPABASE_URL=https://test.supabase.co');
console.log('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
console.log('sk-1234567890abcdef...');
```

## 📝 Configuration

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development vs Production
- Security features are most active in development
- Production builds have reduced logging
- Sensitive data is never exposed in production

## 🛠️ Troubleshooting

### If Sensitive Data Still Appears
1. Check that `initializeSecureLogging()` is called early
2. Verify environment variables are properly set
3. Ensure no direct logging of sensitive data
4. Check for third-party libraries that might bypass our protection

### Debugging Issues
```typescript
import { containsSensitiveData } from '../utils/security';

// Check if a string contains sensitive data
if (containsSensitiveData(someString)) {
  console.log('Contains sensitive data, should be obfuscated');
}
```

---

**Note**: These security features are designed to prevent accidental exposure of sensitive data during development. Always follow security best practices and never commit sensitive data to version control. 