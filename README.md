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
`https://users.roblox.com/v1/users/authenticated` endpoint with the
`Roblox/WinInet` user agent. A quick Node snippet:

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

You can also hit the Supabase `verify-cookie` function directly:

```bash
curl -X POST "${VITE_SUPABASE_URL}/functions/v1/verify-cookie" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"cookie": "your_cookie"}'
```

### Deploying Supabase Functions

Ensure that the `verify-cookie` function is deployed so the admin panel can
reach it. From the project root run:

```bash
supabase functions deploy verify-cookie
```

Both `verify-cookie` and `roblox-status` require the environment variables
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` when running on the edge.
Optionally provide `ROBLOX_COOKIE` to set a default cookie. Without these the
functions will fail to store or load your Roblox cookie.

Deploy any other functions, such as `roblox-status`, in the same way.

### Debugging Presence

If players appear online but the response lacks `placeId` or `universeId`, the
cookie may be missing or invalid. You can quickly check by calling the
`roblox-status` function with a test user and inspecting the `presenceMethod`
and `attemptLog` fields:

```typescript
const { data, error } = await supabase.functions.invoke('roblox-status', {
  body: {
    userId: USER_ID,
    cookie: ROBLOX_COOKIE
  }
});
```

When invoking `roblox-status`, include the `.ROBLOSECURITY` cookie inside the
JSON body. The function reattaches it to outgoing requests server-side so that
the Roblox API receives it correctly.

The `presenceMethod` indicates which API was used (`primary` for
`roblox-proxy`, `fallback` for RoProxy and `direct` for Roblox). All methods
still require a valid `.ROBLOSECURITY` cookie in order for the Presence API to
return detailed information such as `placeId` and `universeId`.
When invoking the function, the logs will now state whether a cookie was
received and applied. Look for messages like `Request included cookie: true` to
confirm the header was sent.

### Calling `roblox-status` with fetch

Send a POST request with `Content-Type: application/json` and include a body containing the Roblox `userId`:

```javascript
await fetch("/functions/v1/roblox-status", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ userId: 261 })
});
```

## Activity Pulse System

The Activity Pulse system provides intelligent activity tracking and insights for players across multiple Roblox accounts. It tracks daily and weekly activity patterns, detects timezones, identifies peak hours, and provides trend analysis.

### Features

- **Activity Level Tracking**: Very Active (120+ min/day), Moderately Active (60-120 min/day), Lightly Active (15-60 min/day), Inactive (<15 min/day)
- **Trend Analysis**: Increasing, decreasing, or stable activity patterns
- **Timezone Detection**: Automatically detects player timezones based on activity patterns
- **Peak Hours Analysis**: Identifies when players are most active
- **Multi-Account Aggregation**: Combines activity data across all player accounts
- **Temporary Disconnect Handling**: Intelligently handles brief disconnections

### Database Schema

The system uses the `roblox_user_status` table with additional columns:

```sql
-- Activity pulse columns
daily_minutes_today INTEGER DEFAULT 0,
daily_minutes_yesterday INTEGER DEFAULT 0,
weekly_total_minutes INTEGER DEFAULT 0,
weekly_average DECIMAL(5,2) DEFAULT 0,
activity_trend TEXT DEFAULT 'stable',
preferred_time_period TEXT DEFAULT 'unknown',
detected_timezone TEXT DEFAULT 'unknown',
peak_hours_start INTEGER DEFAULT NULL,
peak_hours_end INTEGER DEFAULT NULL,
activity_distribution JSONB DEFAULT '{}',
last_disconnect_time TIMESTAMP WITH TIME ZONE,
session_start_time TIMESTAMP WITH TIME ZONE
```

### Maintenance

The system includes automated maintenance functions:

- **Daily Reset**: `reset_daily_activity_data()` - Runs at midnight to reset daily metrics
- **Data Cleanup**: `cleanup_activity_data()` - Runs weekly to clean up inactive users
- **Health Monitoring**: `activity_pulse_health` view for system monitoring

### Admin Interface

Access the Activity Pulse Manager in the Admin Dashboard to:
- Monitor system health
- Manually trigger maintenance tasks
- View activity statistics
- Set up automated scheduling

### Scheduling Setup

For automatic maintenance, you can:

1. **Use pg_cron** (recommended):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   SELECT setup_activity_pulse_scheduling();
   ```

2. **Manual scheduling** via cron, Windows Task Scheduler, or external services

See the Activity Pulse Manager in the Admin Dashboard for detailed setup instructions.

