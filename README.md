# career-ops-plugin-google-calendar

A [career-ops](https://github.com/santifer/career-ops) community plugin that reads your Google Calendar, detects upcoming interview events, and surfaces them in the career-ops pipeline.

## What it does

- Exchanges your OAuth refresh token for a short-lived access token (no SDK, pure REST)
- Fetches events from your primary calendar for the next 14 days (configurable)
- Filters by interview keywords in English and Chinese
- Extracts the join URL (Google Meet, Teams, Zoom) from each event
- Returns `Job[]` for the career-ops `ingest` hook

## Install

```bash
node plugins.mjs install https://github.com/Schlaflied/career-ops-plugin-google-calendar
```

## Setup

### 1. Google Cloud Console

1. Create a project (or use an existing one)
2. Enable the **Google Calendar API**
3. Create an **OAuth 2.0 Client ID** — type: Desktop app
4. Note your `client_id` and `client_secret`

### 2. Get a refresh token

Use the auth flow in `hud/calendar.mjs` (if you have it) or any OAuth2 playground with scope:
```
https://www.googleapis.com/auth/calendar.readonly
```
Copy the `refresh_token` from the token response.

### 3. Add to `.env`

```
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token
```

### 4. Enable

```bash
node plugins.mjs enable google-calendar --confirm
```

## Optional config (`config/plugins.yml`)

```yaml
google-calendar:
  daysAhead: 14       # look-ahead window in days (default: 14)
  maxResults: 50      # max events per fetch (default: 50)
  allEvents: false    # true = return all events, skips interview-keyword filter
```

## Privacy

All API calls go through `ctx.fetch` and are limited to `oauth2.googleapis.com` and `www.googleapis.com`. No data leaves your machine to any third-party service. Credentials stay in your local `.env`.

## License

MIT
