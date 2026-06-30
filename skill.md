# career-ops-plugin-google-calendar

Reads upcoming Google Calendar events, filters for interview signals, and surfaces them in the career-ops pipeline.

## Setup

### 1. Get OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create a project → Enable the **Google Calendar API**
2. Create an OAuth 2.0 Client ID (Desktop app)
3. Download the client secret JSON

### 2. Get a refresh token

Run the one-time auth flow using your preferred OAuth tool (e.g. the existing `hud/calendar.mjs` auth flow, or any OAuth2 playground). You need:
- Scope: `https://www.googleapis.com/auth/calendar.readonly`
- Once authorized, copy the `refresh_token` from the token response

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

## Optional settings (`config/plugins.yml`)

```yaml
google-calendar:
  daysAhead: 14        # how many days ahead to look (default: 14)
  maxResults: 50       # max events to fetch (default: 50)
  allEvents: false     # true = return all events, false = interview keywords only
```

## How it works

The `ingest` hook:
1. Exchanges your refresh token for an access token
2. Fetches events from your primary calendar for the next N days
3. Filters by interview keywords (EN + ZH): interview, screen, prescreen, recruiter, panel, etc.
4. Extracts the join URL (Google Meet / Teams / Zoom) from each event
5. Returns `Job[]` for the career-ops pipeline
