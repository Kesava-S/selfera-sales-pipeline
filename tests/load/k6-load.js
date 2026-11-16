// k6 load test for the sales app.
//
//   k6 run tests/load/k6-load.js                                   # public paths, production
//   BASE_URL=https://selfera-sales-staging.vercel.app k6 run tests/load/k6-load.js
//   SESSION_COOKIE='<cookie header from your signed-in browser>' k6 run tests/load/k6-load.js
//
// Without SESSION_COOKIE it tests what anyone can reach: the login page, the
// sign-in redirect on /dashboard (runs the session check), the WhatsApp webhook
// check (reads Integrations from the database) and a static file.
// With SESSION_COOKIE it also loads the main signed-in pages.
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'https://sales.selfera.co.uk'
const COOKIE = __ENV.SESSION_COOKIE || ''
const PEAK = Number(__ENV.PEAK_USERS || 50)

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.round(PEAK * 0.4) }, // warm up
        { duration: '1m', target: Math.round(PEAK * 0.4) },  // steady
        { duration: '20s', target: PEAK },                   // spike
        { duration: '40s', target: PEAK },
        { duration: '20s', target: 0 },                      // cool down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
}

const signedIn = ['/dashboard', '/dashboard/leads', '/dashboard/audience', '/dashboard/whatsapp-campaigns',
  '/dashboard/insights', '/dashboard/templates', '/dashboard/notifications', '/dashboard/settings',
  '/dashboard/status/needs-reply', '/dashboard/status/went-cold']
const keyOf = p => p.replace('/dashboard', 'dash').replace(/[^a-z]+/g, '_')

// k6 needs every metric created up front
const pageTime = Object.fromEntries(
  ['login', 'dashboard_redirect', 'webhook_check', 'static', ...signedIn.map(keyOf)]
    .map(n => [n, new Trend(`page_${n}`, true)]))
const trend = name => pageTime[name]

function hit(name, path, params = {}, ok = r => r.status === 200) {
  const res = http.get(`${BASE}${path}`, { redirects: 0, tags: { page: name }, ...params })
  trend(name).add(res.timings.duration)
  check(res, { [`${name} ok`]: ok })
  return res
}

export default function () {
  group('public', () => {
    hit('login', '/login')
    hit('dashboard_redirect', '/dashboard', { responseCallback: http.expectedStatuses(200, 302, 307) }, r => r.status === 307 || r.status === 302 || r.status === 200)
    // 403 is the right answer for a wrong token, so k6 shouldn't count it as a failure
    hit('webhook_check', '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=loadtest&hub.challenge=1', { responseCallback: http.expectedStatuses(403) }, r => r.status === 403)
    hit('static', '/favicon.ico')
  })
  if (COOKIE) {
    group('signed_in', () => {
      for (const p of signedIn) {
        hit(keyOf(p), p, { headers: { Cookie: COOKIE } })
      }
    })
  }
  sleep(1 + Math.random())
}
