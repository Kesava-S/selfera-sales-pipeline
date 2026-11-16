import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 25 },
    { duration: '15s', target: 60 },
    { duration: '20s', target: 100 },
    { duration: '15s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    'http_req_failed': ['rate<0.05'], // allow max 5% error under extreme saturation
    'http_req_duration': ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const rand = Math.random();

  if (rand < 0.5) {
    // 50% SSR Login page
    const res = http.get(`${BASE_URL}/login`);
    check(res, {
      'login status 200': (r) => r.status === 200,
    });
  } else if (rand < 0.8) {
    // 30% Unauthenticated redirect (tests middleware performance under load)
    const res = http.get(`${BASE_URL}/dashboard`, { redirects: 0 });
    check(res, {
      'redirect status valid': (r) => r.status === 307 || r.status === 302,
    });
  } else {
    // 20% Webhook probe
    const res = http.get(
      `${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=probe`,
      { responseCallback: http.expectedStatuses(403) }
    );
    check(res, {
      'webhook status 403': (r) => r.status === 403,
    });
  }

  // Short pause to keep pressure high
  sleep(0.1 + Math.random() * 0.2);
}
