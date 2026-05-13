// k6 load test: leave-load.js
//
// Scenario: 100 virtual users for 2 minutes.
// Each VU performs:
//   GET /api/v1/leave-requests            (own requests)
//   GET /api/v1/employees/:id/leave-balance (leave balance)
//
// Run against local docker-compose:
//   BASE_URL=http://localhost:8080 k6 run leave-load.js
//
// Run against deployed URL:
//   BASE_URL=https://your-deployment.example.com k6 run leave-load.js
//
// Thresholds:
//   - p(95) < 300 ms for all requests
//   - http_req_failed < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const leaveDuration   = new Trend('leave_duration');
const balanceDuration = new Trend('balance_duration');
const errorRate       = new Rate('error_rate');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus:      100,
  duration: '2m',
  thresholds: {
    leave_duration:   ['p(95)<300'],
    balance_duration: ['p(95)<300'],
    http_req_failed:  ['rate<0.01'],
    error_rate:       ['rate<0.01'],
  },
};

const TEST_EMAIL    = __ENV.TEST_EMAIL    || 'loadtest@nexus.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'loadtest123';

// Shared access token set once per VU lifecycle.
let accessToken   = null;
let employeeId    = null;

export function setup() {
  // Login once and share the token across the test run.
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    console.error(`Setup login failed: ${res.status} ${res.body}`);
    return { accessToken: null, employeeId: null };
  }
  const body = JSON.parse(res.body);
  return { accessToken: body.accessToken, employeeId: body.employeeId || 1 };
}

export default function (data) {
  if (!data.accessToken) {
    sleep(1);
    return;
  }

  const authHeaders = {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  };

  // ── Request 1: GET /api/v1/leave-requests ─────────────────────────────────
  const leaveStart = Date.now();
  const leaveRes = http.get(`${BASE_URL}/api/v1/leave-requests?limit=10`, authHeaders);
  leaveDuration.add(Date.now() - leaveStart);

  check(leaveRes, {
    'leave-requests: status 200': (r) => r.status === 200,
  });
  errorRate.add(leaveRes.status >= 500);

  sleep(0.3);

  // ── Request 2: GET /api/v1/employees/:id/leave-balance ────────────────────
  const empId       = data.employeeId || 1;
  const balStart    = Date.now();
  const balanceRes  = http.get(`${BASE_URL}/api/v1/employees/${empId}/leave-balance`, authHeaders);
  balanceDuration.add(Date.now() - balStart);

  check(balanceRes, {
    'leave-balance: status 200 or 403': (r) => r.status === 200 || r.status === 403,
  });
  errorRate.add(balanceRes.status >= 500);

  sleep(0.7);
}
