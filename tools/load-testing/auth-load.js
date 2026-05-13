// k6 load test: auth-load.js
//
// Scenario: 50 virtual users for 1 minute.
// Each VU performs: login → 2 protected requests → logout.
//
// Run against local docker-compose:
//   BASE_URL=http://localhost:8080 k6 run auth-load.js
//
// Run against deployed URL:
//   BASE_URL=https://your-deployment.example.com k6 run auth-load.js
//
// Thresholds:
//   - p(95) of login requests < 500 ms
//   - http_req_failed < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const loginDuration = new Trend('login_duration');
const errorRate     = new Rate('error_rate');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus:      50,
  duration: '1m',
  thresholds: {
    login_duration:         ['p(95)<500'],
    http_req_failed:        ['rate<0.01'],
    error_rate:             ['rate<0.01'],
  },
};

// Pre-registered test credentials (seed these before running).
// In CI, create a test user via the seed script first.
const TEST_EMAIL    = __ENV.TEST_EMAIL    || 'loadtest@nexus.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'loadtest123';

export default function () {
  // ── Step 1: Login ──────────────────────────────────────────────────────────
  const loginStart = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginDuration.add(Date.now() - loginStart);

  const loginOk = check(loginRes, {
    'login: status 200':     (r) => r.status === 200,
    'login: has accessToken': (r) => {
      try { return JSON.parse(r.body).accessToken !== undefined; }
      catch { return false; }
    },
  });
  errorRate.add(!loginOk);

  if (!loginOk) {
    sleep(1);
    return;
  }

  const { accessToken, refreshToken } = JSON.parse(loginRes.body);
  const authHeaders = {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  // ── Step 2: Protected request #1 — GET /api/employees/me ──────────────────
  const meRes = http.get(`${BASE_URL}/api/employees/me`, authHeaders);
  check(meRes, {
    'GET /me: status 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  errorRate.add(meRes.status >= 500);

  sleep(0.5);

  // ── Step 3: Protected request #2 — GET /api/v1/employees ─────────────────
  const listRes = http.get(`${BASE_URL}/api/v1/employees?limit=5`, authHeaders);
  check(listRes, {
    'GET /employees: status 200': (r) => r.status === 200,
  });
  errorRate.add(listRes.status >= 500);

  sleep(0.5);

  // ── Step 4: Logout ─────────────────────────────────────────────────────────
  const logoutRes = http.post(
    `${BASE_URL}/api/auth/logout`,
    JSON.stringify({ refreshToken }),
    authHeaders,
  );
  check(logoutRes, {
    'logout: status 200': (r) => r.status === 200,
  });

  sleep(1);
}
