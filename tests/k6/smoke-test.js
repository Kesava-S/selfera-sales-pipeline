import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    'http_req_duration': ['p(95)<300'],
    'checks': ['rate==1.0'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Sign-in Page (Server-Side Rendered HTML)
  const loginRes = http.get(`${BASE_URL}/login`);
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login includes brand': (r) => r.body && r.body.includes('Selfera'),
  });

  // 2. Offline Fallback Page
  const offlineRes = http.get(`${BASE_URL}/offline`);
  check(offlineRes, {
    'offline status is 200': (r) => r.status === 200,
  });

  // 3. Opt-Out Landing Page
  const optOutPageRes = http.get(`${BASE_URL}/opt-out`);
  check(optOutPageRes, {
    'opt-out page status is 200': (r) => r.status === 200,
  });

  // 4. Protected Route Redirect Validation
  const dashRes = http.get(`${BASE_URL}/dashboard`, { redirects: 0 });
  check(dashRes, {
    'unauthenticated dashboard redirects': (r) => r.status === 307 || r.status === 302,
  });

  // 5. WhatsApp Webhook Verification Endpoint (403 Expected for invalid token)
  const webhookRes = http.get(
    `${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test1234&hub.verify_token=invalid_test_token`,
    { responseCallback: http.expectedStatuses(403) }
  );
  check(webhookRes, {
    'webhook verification rejects invalid token with 403': (r) => r.status === 403,
  });

  // 6. One-Click Opt-Out API (400 Expected for empty payload)
  const optOutApiRes = http.post(
    `${BASE_URL}/api/opt-out`,
    null,
    { responseCallback: http.expectedStatuses(400) }
  );
  check(optOutApiRes, {
    'opt-out api rejects empty payload with 400': (r) => r.status === 400,
  });

  sleep(0.5);
}
