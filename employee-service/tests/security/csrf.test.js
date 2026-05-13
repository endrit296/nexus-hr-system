// CSRF (Cross-Site Request Forgery) tests for employee-service.
//
// ── Threat Model ─────────────────────────────────────────────────────────────
//
// Token-based APIs (like this one) do NOT require CSRF tokens because:
//   1. The browser does NOT automatically attach the Authorization header on
//      cross-origin requests.  A CSRF attack relies on the browser automatically
//      sending credentials (cookies, HTTP Basic Auth).  Bearer tokens in the
//      Authorization header are immune to this — an attacker's page cannot
//      programmatically access the victim's token due to the Same-Origin Policy.
//   2. This service receives its auth context via x-user-role / x-user-email
//      headers set by the API gateway AFTER JWT verification.  A direct request
//      to this service without those headers gets 401.
//
// What these tests verify:
//   A. State-changing requests WITHOUT any auth headers → 401.
//   B. State-changing requests WITH an Origin header that differs from the app's
//      own origin → still processed (CSRF protection is not relevant for token
//      auth; the Origin check is the API gateway's responsibility).
//   C. The service does NOT use cookies for session state, so there is no cookie
//      to steal in a CSRF attack.
//
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('../../config/database', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  return { sequelize, connectDB: async () => {} };
});

jest.mock('../../cache',        () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() }));
jest.mock('../../messenger',    () => ({ sendToQueue: jest.fn().mockResolvedValue(true) }));
jest.mock('../../logger',       () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('node-schedule',   () => ({ scheduleJob: jest.fn() }));

const express    = require('express');
const request    = require('supertest');
const { sequelize } = require('../../config/database');

const Employee           = require('../../models/Employee');
const Department         = require('../../models/Department');
const LeaveType          = require('../../models/LeaveType');
const LeaveRequest       = require('../../models/LeaveRequest');
const LeaveBalanceLedger = require('../../models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('../../models/LeaveRequestAudit');

Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',    onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',          onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',       onDelete: 'SET NULL', hooks: true });
Employee.hasMany(LeaveRequest,         { foreignKey: 'employeeId',       as: 'leaveRequests'  });
LeaveRequest.belongsTo(Employee,       { foreignKey: 'employeeId',       as: 'employee'       });
LeaveType.hasMany(LeaveRequest,        { foreignKey: 'leaveTypeId',      as: 'requests'       });
LeaveRequest.belongsTo(LeaveType,      { foreignKey: 'leaveTypeId',      as: 'leaveType'      });
Employee.hasMany(LeaveBalanceLedger,   { foreignKey: 'employeeId',       as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(Employee, { foreignKey: 'employeeId',       as: 'employee'       });
LeaveType.hasMany(LeaveBalanceLedger,  { foreignKey: 'leaveTypeId',      as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(LeaveType,{ foreignKey: 'leaveTypeId',      as: 'leaveType'      });
LeaveRequest.hasMany(LeaveBalanceLedger,   { foreignKey: 'relatedRequestId', as: 'ledgerEntries' });
LeaveBalanceLedger.belongsTo(LeaveRequest, { foreignKey: 'relatedRequestId', as: 'request'       });
LeaveRequest.hasMany(LeaveRequestAudit,    { foreignKey: 'requestId', as: 'auditEntries' });
LeaveRequestAudit.belongsTo(LeaveRequest,  { foreignKey: 'requestId', as: 'request'      });

const employeeRoutes = require('../../routes/employee');
const leaveRoutes    = require('../../routes/leave');

const app = express();
app.use(express.json());
app.use('/employees',      employeeRoutes);
app.use('/leave-requests', leaveRoutes);

const nextYear = new Date().getFullYear() + 1;
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const futureDay = (() => {
  const d = new Date(nextYear, 4, 5);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return isoLocal(d);
})();

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
  await LeaveRequestAudit.destroy({ where: {} });
  await LeaveBalanceLedger.destroy({ where: {} });
  await LeaveRequest.destroy({ where: {} });
  await Employee.destroy({ where: {}, force: true });
  await LeaveType.destroy({ where: {} });
});

// ── A. Requests without auth headers → 401 ───────────────────────────────────

describe('CSRF safeguard A: state-changing requests without auth headers → 401', () => {
  it('POST /employees without x-user-role returns 401', async () => {
    const res = await request(app)
      .post('/employees')
      .send({ firstName: 'CSRF', lastName: 'Attacker', email: 'csrf@evil.com' });
    expect(res.status).toBe(401);
  });

  it('PUT /employees/:id without x-user-role returns 401', async () => {
    const emp = await Employee.create({ firstName: 'Real', lastName: 'User', email: 'real@test.com' });
    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .send({ firstName: 'Hijacked' });
    expect(res.status).toBe(401);
  });

  it('DELETE /employees/:id without x-user-role returns 401', async () => {
    const emp = await Employee.create({ firstName: 'Real', lastName: 'User', email: 'real2@test.com' });
    const res = await request(app).delete(`/employees/${emp.id}`);
    expect(res.status).toBe(401);
  });

  it('POST /leave-requests without x-user-email returns 404 (no employee found)', async () => {
    // resolveEmployee middleware sets req.employee = null when email is missing.
    // The route then returns 404.  Either 401 or 404 is acceptable — both prevent
    // the unauthenticated request from creating data.
    const res = await request(app)
      .post('/leave-requests')
      .send({ leaveTypeId: 1, startDate: futureDay, endDate: futureDay });
    expect([401, 404]).toContain(res.status);
  });

  it('POST /leave-requests/:id/approve without x-user-role returns 401', async () => {
    const res = await request(app)
      .post('/leave-requests/1/approve')
      .send({});
    expect(res.status).toBe(401);
  });
});

// ── B. Requests with a different Origin header are still processed ────────────
//
// This documents the correct behaviour: Origin-header checks are the API
// gateway's job.  The employee-service itself does not enforce Origin — that
// would be redundant for a token-based API.

describe('CSRF safeguard B: different Origin header does not break token-based requests', () => {
  it('POST /employees with a "foreign" Origin still succeeds with valid auth headers', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .set('Origin', 'https://evil.attacker.com')
      .send({ firstName: 'Origin', lastName: 'Test', email: 'origintest@test.com' });

    // Token-based APIs process the request regardless of Origin.
    // The API gateway (with CORS config) would block cross-origin preflight,
    // but simple CORS requests reach the service.
    expect(res.status).toBe(201);
  });

  it('a request with no Origin header succeeds (curl / server-to-server pattern)', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      // No Origin header — typical for server-to-server calls
      .send({ firstName: 'NoOrigin', lastName: 'Test', email: 'noorigin@test.com' });

    expect(res.status).toBe(201);
  });
});

// ── C. No cookies used ────────────────────────────────────────────────────────

describe('CSRF safeguard C: no session cookies in responses', () => {
  it('GET /employees response does not set a Set-Cookie header', async () => {
    const res = await request(app).get('/employees').set('x-user-role', 'employee');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('POST /employees response does not set a Set-Cookie header', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'NoCookie', lastName: 'Test', email: 'nocookie@test.com' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
