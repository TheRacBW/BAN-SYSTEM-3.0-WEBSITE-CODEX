# BAN-SYSTEM-3.0-WEBSITE-CODEX

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/TheRacBW/BAN-SYSTEM-3.0-WEBSITE-CODEX)

## Environment Variables

The `roblox-status` function uses the Roblox Presence API and requires a `.ROBLOSECURITY` cookie for detailed presence information. The cookie can be provided either via the `ROBLOX_COOKIE` environment variable or stored in the `roblox_settings` table (row with `id` set to `global`). If both are present, the table value is used.

All Roblox API requests are sent with the headers `User-Agent: Roblox/WinInet` and `Referer: https://www.roblox.com/` to mimic the official client. Ensure your environment allows these headers to pass through.

Set the cookie in your deployment environment using the `ROBLOX_COOKIE` variable:

```bash
export ROBLOX_COOKIE=your_roblox_cookie_here
```
