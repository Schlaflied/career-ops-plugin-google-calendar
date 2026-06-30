// Smoke test — verifies plugin contract without hitting Google APIs
import plugin from '../index.mjs';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  ✅ ${msg}`); passed++; }
  else           { console.error(`  ❌ ${msg}`); failed++; }
}

function mockCtx(calendarEvents = [], settings = {}) {
  let callCount = 0;
  return {
    env: {
      GOOGLE_CALENDAR_CLIENT_ID:     'client-id-test',
      GOOGLE_CALENDAR_CLIENT_SECRET: 'client-secret-test',
      GOOGLE_CALENDAR_REFRESH_TOKEN: 'refresh-token-test',
    },
    settings,
    async fetch(url) {
      callCount++;
      if (url.includes('oauth2.googleapis.com/token')) {
        return { ok: true, json: async () => ({ access_token: 'test-token' }), text: async () => '' };
      }
      if (url.includes('googleapis.com/calendar')) {
        return { ok: true, json: async () => ({ items: calendarEvents }), text: async () => '' };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
    getCallCount: () => callCount,
  };
}

const SAMPLE_EVENTS = [
  {
    summary: 'Interview with Acme Corp',
    start: { dateTime: '2026-07-01T14:00:00-04:00' },
    end:   { dateTime: '2026-07-01T14:30:00-04:00' },
    hangoutLink: 'https://meet.google.com/abc-def-ghi',
    location: '',
  },
  {
    summary: 'Prescreen — Beta Technologies',
    start: { dateTime: '2026-07-02T10:00:00-04:00' },
    end:   { dateTime: '2026-07-02T10:30:00-04:00' },
    description: 'Join Teams: https://teams.microsoft.com/l/meetup-join/abc123',
    location: '',
  },
  {
    summary: 'Budget review Q3',
    start: { dateTime: '2026-07-03T09:00:00-04:00' },
    end:   { dateTime: '2026-07-03T10:00:00-04:00' },
    location: 'Toronto ON',
  },
];

console.log('career-ops-plugin-google-calendar smoke test\n');

// 1. Plugin shape
console.log('1. Plugin shape');
assert(typeof plugin === 'object',          'default export is object');
assert(typeof plugin.ingest === 'function', 'exports ingest hook');

// 2. ingest filters non-interview events
console.log('\n2. ingest hook — keyword filtering');
const ctx  = mockCtx(SAMPLE_EVENTS);
const jobs = await plugin.ingest(ctx);
assert(Array.isArray(jobs),       'returns array');
assert(jobs.length === 2,         'filters out non-interview event (got ' + jobs.length + ')');
assert(jobs[0].title  !== undefined, 'job has title');
assert(jobs[0].url    !== undefined, 'job has url');
assert(jobs[0].company !== undefined,'job has company');

// 3. Join URL extraction
console.log('\n3. Join URL extraction');
assert(jobs[0].url === 'https://meet.google.com/abc-def-ghi', 'extracts Google Meet link');
assert(jobs[1].url === 'https://teams.microsoft.com/l/meetup-join/abc123', 'extracts Teams link from description');

// 4. Company extraction
console.log('\n4. Company extraction');
assert(jobs[0].company === 'Acme Corp',          'extracts company from "Interview with X"');
assert(jobs[1].company === 'Beta Technologies',  'extracts company from "Prescreen — X"');

// 5. allEvents setting bypasses filter
console.log('\n5. allEvents setting');
const allCtx  = mockCtx(SAMPLE_EVENTS, { allEvents: true });
const allJobs = await plugin.ingest(allCtx);
assert(allJobs.length === 3, 'allEvents:true returns all events');

// 6. Token exchange is called
console.log('\n6. OAuth flow');
assert(ctx.getCallCount() >= 2, 'at least 2 fetch calls (token + calendar)');

console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
