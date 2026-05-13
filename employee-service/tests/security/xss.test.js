// XSS (Cross-Site Scripting) tests for employee-service.
//
// The service returns JSON responses, not HTML.  XSS via stored payloads is
// mitigated because:
//   1. The API returns Content-Type: application/json — browsers won't execute
//      scripts from JSON responses.
//   2. Responsibility for HTML-escaping lies with the frontend (React) at render time.
//
// These tests verify:
//   - XSS payloads are stored and retrieved as literal strings (not executed).
//   - No response is returned with Content-Type: text/html containing the payload.
//   - The API never returns a 500 from XSS input.
//
// Tested surfaces:
//   - POST /employees → GET /employees/:id (firstName, lastName)
//   - POST /leave-requests → GET /leave-requests/:id (reason)
//   - POST /leave-requests/:id/reject (decisionNote)

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

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
];

const nextYear = new Date().getFullYear() + 1;

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const futureMonday = (() => {
  const d = new Date(nextYear, 3, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
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

function assertJsonResponse(res) {
  const ct = res.headers['content-type'] || '';
  expect(ct).toMatch(/application\/json/);
  // Must NOT be text/html — that's where XSS would execute
  expect(ct).not.toMatch(/text\/html/);
}

// ── POST /employees then GET → firstName field ────────────────────────────────

describe('XSS in employee firstName — store-and-retrieve', () => {
  for (const payload of XSS_PAYLOADS) {
    it(`payload "${payload.slice(0, 30)}..." stored and returned as literal JSON string`, async () => {
      const createRes = await request(app)
        .post('/employees')
        .set('x-user-role', 'admin')
        .send({ firstName: payload, lastName: 'XSS', email: `xss-fn-${Date.now()}@test.com` });

      // May fail Joi validation — that's fine, but must not be 500
      expect(createRes.status).not.toBe(500);

      if (createRes.status === 201) {
        assertJsonResponse(createRes);

        // Retrieve and confirm JSON response
        const getRes = await request(app)
          .get(`/employees/${createRes.body.id}`)
          .set('x-user-role', 'admin');

        expect(getRes.status).toBe(200);
        assertJsonResponse(getRes);

        // Value is present as a raw string — frontend is responsible for escaping
        expect(getRes.body.firstName).toBe(payload);
      }
    });
  }
});

// ── POST /leave-requests then GET → reason field ──────────────────────────────

describe('XSS in leave request reason — store-and-retrieve', () => {
  async function setupLeave() {
    const emp    = await Employee.create({ firstName: 'XSS', lastName: 'User', email: `xss-leave-${Date.now()}@test.com` });
    const annual = await LeaveType.create({ code: 'annual', name: 'Annual', isPaid: true });
    await LeaveBalanceLedger.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 20, reason: 'grant',
      effectiveDate: `${nextYear}-01-01`, createdByUserId: 'test',
    });
    return { emp, annual };
  }

  for (const payload of XSS_PAYLOADS) {
    it(`reason "${payload.slice(0, 30)}..." returned as JSON string (never as HTML)`, async () => {
      const { emp, annual } = await setupLeave();

      const createRes = await request(app)
        .post('/leave-requests')
        .set({ 'x-user-email': emp.email, 'x-user-role': 'employee', 'x-user-id': 'test' })
        .send({ leaveTypeId: annual.id, startDate: futureMonday, endDate: futureMonday, reason: payload });

      expect(createRes.status).not.toBe(500);

      if (createRes.status === 201) {
        assertJsonResponse(createRes);
        // The reason field is returned in JSON, not rendered as HTML
        expect(createRes.body.reason).toBe(payload);
      }
    });
  }
});

// ── POST /leave-requests/:id/reject → decisionNote field ─────────────────────

describe('XSS in leave request decisionNote — store-and-retrieve', () => {
  async function setupApproval() {
    const manager = await Employee.create({ firstName: 'XSS', lastName: 'Manager', email: `xss-mgr-${Date.now()}@test.com` });
    const emp     = await Employee.create({ firstName: 'XSS', lastName: 'Emp', email: `xss-emp-${Date.now()}@test.com`, managerId: manager.id });
    const annual  = await LeaveType.create({ code: 'annual', name: 'Annual', isPaid: true });
    await LeaveBalanceLedger.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 20, reason: 'grant',
      effectiveDate: `${nextYear}-01-01`, createdByUserId: 'test',
    });
    const leaveReq = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee', 'x-user-id': 'test' })
      .send({ leaveTypeId: annual.id, startDate: futureMonday, endDate: futureMonday });
    return { manager, emp, leaveId: leaveReq.body.id };
  }

  for (const payload of XSS_PAYLOADS) {
    it(`decisionNote "${payload.slice(0, 30)}..." returned as JSON (never HTML)`, async () => {
      const { manager, leaveId } = await setupApproval();

      if (!leaveId) return; // skip if leave creation failed

      const rejectRes = await request(app)
        .post(`/leave-requests/${leaveId}/reject`)
        .set({ 'x-user-email': manager.email, 'x-user-role': 'manager', 'x-user-id': 'test' })
        .send({ decisionNote: payload });

      expect(rejectRes.status).not.toBe(500);

      if (rejectRes.status === 200) {
        assertJsonResponse(rejectRes);
        expect(rejectRes.body.decisionNote).toBe(payload);
      }
    });
  }
});
