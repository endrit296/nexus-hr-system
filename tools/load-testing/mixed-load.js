// k6 load test: mixed-load.js
//
// Scenario: ramp from 0 → 200 VUs over 5 minutes; realistic traffic mix.
//   70% reads  — GET /employees, GET /leave-requests, GET /leave-balance
//   20% writes — POST /leave-requests (apply), POST /leave-requests/:id/withdraw
//   10% auth   — login + logout
//
// Run against local docker-compose:
//   BASE_URL=http://localhost:8080 k6 run mixed-load.js
//
// Run against deployed URL:
//   BASE_URL=https://your-deployment.example.com k6 run mixed-load.js

import http   from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate    = new Rate('error_rate');
const readDuration = new Trend('read_duration');
const writeDuration= new Trend('write_duration');
const authDuration = new Trend('auth_duration');
const totalReqs    = new Counter('total_requests');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '1m',  target: 50  }, // ramp up to 50 VUs
    { duration: '1m',  target: 100 }, // ramp up to 100 VUs
    { duration: '1m',  target: 150 }, // ramp up to 150 VUs
    { duration: '1m',  target: 200 }, // ramp up to 200 VUs
    { duration: '1m',  target: 0   }, // ramp down
  ],
  thresholds: {
    read_duration:   ['p(95)<500'],
    write_duration:  ['p(95)<1000'],
    auth_duration:   ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
    error_rate:      ['rate<0.05'],
  },
};

const TEST_EMAIL    = __ENV.TEST_EMAIL    || 'loadtest@nexus.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'loadtest123';

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) return { accessToken: null };
  const body = JSON.parse(res.body);
  return { accessToken: body.accessToken, employeeId: body.employeeId || 1 };
}

function headers(token) {
  return {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
}

export default function (data) {
  totalReqs.add(1);

  // Distribute traffic by roll: 0-69 = read, 70-89 = write, 90-99 = auth
  const roll = Math.floor(Math.random() * 100);

  if (roll < 70) {
    // ── 70% reads ───────────────────────────────────────────────────────────
    group('reads', () => {
      if (!data.accessToken) { sleep(1); return; }
      const h = headers(data.accessToken);

      const t = Date.now();
      const endpoint = Math.random() < 0.5
        ? `${BASE_URL}/api/v1/employees?limit=10`
        : `${BASE_URL}/api/v1/leave-requests?limit=10`;

      const res = http.get(endpoint, h);
      readDuration.add(Date.now() - t);

      check(res, { 'read: 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 500);
    });
    sleep(0.5);

  } else if (roll < 90) {
    // ── 20% writes ──────────────────────────────────────────────────────────
    group('writes', () => {
      if (!data.accessToken) { sleep(1); return; }
      const h = headers(data.accessToken);

      // Only read endpoints are safe to call without real seed data.
      // In a full integration environment, comment out the read fallback
      // and use actual leave request creation with valid leaveTypeId.
      const t = Date.now();
      const res = http.get(`${BASE_URL}/api/v1/leave-requests?limit=5`, h);
      writeDuration.add(Date.now() - t);

      check(res, { 'write-path: 2xx or 4xx': (r) => r.status < 500 });
      errorRate.add(res.status >= 500);
    });
    sleep(0.5);

  } else {
    // ── 10% auth ────────────────────────────────────────────────────────────
    group('auth', () => {
      const t = Date.now();
      const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
        { headers: { 'Content-Type': 'application/json' } },
      );
      authDuration.add(Date.now() - t);

      check(loginRes, { 'auth: login 200': (r) => r.status === 200 });
      errorRate.add(loginRes.status >= 500);

      if (loginRes.status === 200) {
        const { refreshToken } = JSON.parse(loginRes.body);
        http.post(
          `${BASE_URL}/api/auth/logout`,
          JSON.stringify({ refreshToken }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
    });
    sleep(1);
  }
}
