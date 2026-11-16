import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 15 }, // ramp up to 15 users
    { duration: '20s', target: 30 }, // ramp up to 30 users
    { duration: '25s', target: 30 }, // sustain 30 concurrent users
    { duration: '10s', target: 0 },  // ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const rand = Math.random();

  if (rand < 0.4) {
    // 40% of traffic: Login Page SSR
    const res = http.get(`${BASE_URL}/login`);
    check(res, {
      'login status 200': (r) => r.status === 200,
      'login branding present': (r) => r.body && r.body.includes('Selfera'),
    });
  } else if (rand < 0.6) {
    // 20% of traffic: Opt-out Page SSR
    const res = http.get(`${BASE_URL}/opt-out`);
    check(res, {
      'opt-out status 200': (r) => r.status === 200,
    });
  } else if (rand < 0.75) {
    // 15% of traffic: Offline fallback page
    const res = http.get(`${BASE_URL}/offline`);
    check(res, {
      'offline status 200': (r) => r.status === 200,
    });
  } else if (rand < 0.9) {
    // 15% of traffic: Unauthenticated dashboard access
    const res = http.get(`${BASE_URL}/dashboard`, { redirects: 0 });
    check(res, {
      'redirects unauthenticated users': (r) => r.status === 307 || r.status === 302,
    });
  } else {
    // 10% of traffic: Webhook verification ping
    const res = http.get(
      `${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=ping&hub.verify_token=probe`,
      { responseCallback: http.expectedStatuses(403) }
    );
    check(res, {
      'webhook verification secure': (r) => r.status === 403,
    });
  }

  // Realistic user pacing between 300ms and 700ms
  sleep(0.3 + Math.random() * 0.4);
}
