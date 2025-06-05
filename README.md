# BAN-SYSTEM-3.0-WEBSITE-CODEX

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/TheRacBW/BAN-SYSTEM-3.0-WEBSITE-CODEX)

## Environment Variables

The `roblox-status` function queries the Roblox Presence API through
`https://roblox-proxy.theraccoonmolester.workers.dev` with automatic
fallback to RoProxy. A valid `.ROBLOSECURITY` cookie is required for detailed
presence information. The cookie can be provided either via the `ROBLOX_COOKIE`
environment variable or stored in the `roblox_settings` table (row with `id`
set to `global`). If both are present, the table value is used.

All Roblox API requests are sent with the headers `User-Agent: Roblox/WinInet` and `Referer: https://www.roblox.com/` to mimic the official client. Ensure your environment allows these headers to pass through.

Set the cookie in your deployment environment using the `ROBLOX_COOKIE` variable:

```bash
export ROBLOX_COOKIE=your_roblox_cookie_here
```

### Verify your cookie

Before saving, you can ensure the `.ROBLOSECURITY` cookie works by hitting the
`https://users.roblox.com/v1/users/authenticated` endpoint with the `Roblox/WinInet`
user agent. A quick Node snippet:

```typescript
import axios from 'axios';

axios.get('https://users.roblox.com/v1/users/authenticated', {
  headers: {
    Cookie: `.ROBLOSECURITY=${yourCookie}`,
    'User-Agent': 'Roblox/WinInet'
  }
}).then(r => console.log('Logged in as', r.data.name))
  .catch(e => console.log('Failed -', e.response?.status));
```

The cookie must start with `_|WARNING:` and be copied exactly from your browser.
