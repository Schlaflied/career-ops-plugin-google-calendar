// career-ops-plugin-google-calendar
// Author: Schlaflied · https://github.com/Schlaflied
// License: MIT · https://github.com/Schlaflied/career-ops-plugin-google-calendar
//
// Reads upcoming Google Calendar events, filters for interview signals,
// and returns them as Job[] for the career-ops pipeline.
// Network access only via ctx.fetch (engine enforces allowedHosts).

const TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// EN + ZH interview keywords (mirrors hud/calendar.mjs)
const INTERVIEW_KEYWORDS = [
  'interview', 'screen', 'screening', 'phone call', 'video call',
  'hiring', 'recruiter', 'panel', 'technical', 'round', 'assessment',
  'onsite', 'on-site', 'debrief', 'offer', 'hr call', 'prescreen',
  'pre-screen', 'zoom', 'teams', 'meet',
  '面试', '筛选', '电话', '视频', '招聘', '技术', '笔试', '轮',
];

async function getAccessToken(ctx) {
  const res = await ctx.fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     ctx.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: ctx.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: ctx.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in response');
  return data.access_token;
}

async function listEvents(ctx, accessToken) {
  const now     = new Date();
  const horizon = ctx.settings?.daysAhead ?? 14;
  const timeMax = new Date(now.getTime() + horizon * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin:      now.toISOString(),
    timeMax:      timeMax.toISOString(),
    maxResults:   String(ctx.settings?.maxResults ?? 50),
    singleEvents: 'true',
    orderBy:      'startTime',
  });

  const res = await ctx.fetch(`${CALENDAR_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.items || [];
}

function isInterviewEvent(event) {
  const title = (event.summary || '').toLowerCase();
  const desc  = (event.description || '').toLowerCase();
  return INTERVIEW_KEYWORDS.some(kw => title.includes(kw) || desc.includes(kw));
}

function extractJoinUrl(event) {
  // Google Meet
  if (event.hangoutLink) return event.hangoutLink;
  // Teams / Zoom / other — look in description
  const desc = event.description || '';
  const m = desc.match(/https?:\/\/(?:teams\.microsoft\.com|zoom\.us|meet\.google\.com)[^\s"<>]+/);
  return m ? m[0] : '';
}

function extractCompany(title) {
  // "Interview with Acme Corp", "Prescreen — Acme", "Acme | HR Screen"
  const patterns = [
    /(?:with|@|–|-|—|:)\s+([A-Z][^|–\-—\n]{2,40})/,
    /^([A-Z][^|–\-—\n]{2,30})\s*(?:\||–|-|—)/,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1].trim();
  }
  return title.trim();
}

function formatLocation(event) {
  if (event.location) return event.location;
  if (event.hangoutLink || extractJoinUrl(event)) return 'Remote';
  return '';
}

function eventToJob(event) {
  const title   = event.summary || 'Interview';
  const start   = event.start?.dateTime || event.start?.date || '';
  const url     = extractJoinUrl(event);
  const company = extractCompany(title);
  return {
    title,
    url,
    company,
    location: formatLocation(event),
    // Extra fields passed through for pipeline context
    startTime: start,
    endTime:   event.end?.dateTime || event.end?.date || start,
  };
}

export default {
  async ingest(ctx) {
    const accessToken = await getAccessToken(ctx);
    const events      = await listEvents(ctx, accessToken);

    const interviewEvents = ctx.settings?.allEvents
      ? events
      : events.filter(isInterviewEvent);

    return interviewEvents.map(eventToJob);
  },
};
