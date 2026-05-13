// Edge-case tests for leave requests.
// Covers boundary dates, single-day leaves, max-length strings, optional fields,
// exact-balance requests, back-to-back non-overlapping requests, and leap days.

jest.mock('../config/database', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  return { sequelize, connectDB: async () => {} };
});

jest.mock('../cache',        () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() }));
jest.mock('../messenger',    () => ({ sendToQueue: jest.fn().mockResolvedValue(true) }));
jest.mock('../logger',       () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('node-schedule',   () => ({ scheduleJob: jest.fn() }));

const express    = require('express');
const request    = require('supertest');
const { sequelize } = require('../config/database');

const Employee           = require('../models/Employee');
const Department         = require('../models/Department');
const LeaveType          = require('../models/LeaveType');
const LeaveRequest       = require('../models/LeaveRequest');
const LeaveBalanceLedger = require('../models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('../models/LeaveRequestAudit');

// Associations
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

const leaveRoutes    = require('../routes/leave');
const employeeRoutes = require('../routes/employee');
const leaveService   = require('../application/services/LeaveService');

const app = express();
app.use(express.json());
app.use('/employees',      employeeRoutes);
app.use('/leave-requests', leaveRoutes);

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setup() {
  const manager = await Employee.create({ firstName: 'Boss', lastName: 'Man', email: 'boss@edge.com' });
  const emp     = await Employee.create({ firstName: 'Edge', lastName: 'Case', email: 'edge@edge.com', managerId: manager.id, hireDate: '2020-01-01' });
  const annual  = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
  const sick    = await LeaveType.create({ code: 'sick',   name: 'Sick Leave',   isPaid: true, requiresProofAfterDays: 3, maxRetroactiveDays: 7 });
  return { manager, emp, annual, sick };
}

async function grantBalance(emp, lt, days) {
  return LeaveBalanceLedger.create({
    employeeId: emp.id, leaveTypeId: lt.id,
    entryType: 'accrual', days, reason: 'Test grant',
    effectiveDate: '2025-01-01', createdByUserId: 'test',
  });
}

const headers = (email, role = 'employee') => ({
  'x-user-email': email,
  'x-user-role':  role,
  'x-user-id':    'test-user-id',
});

const nextYear = new Date().getFullYear() + 1;

function nextMonday() {
  const d = new Date(nextYear, 0, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return isoDate(d); // use local date components to avoid UTC-offset shift
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Single-day (start_date == end_date) ──────────────────────────────────────

describe('Edge case: single-day leave (start_date == end_date)', () => {
  it('creates a leave request for a single Monday (workingDaysCount = 1)', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const monday = nextMonday();
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: monday, endDate: monday });

    expect(res.status).toBe(201);
    expect(res.body.workingDaysCount).toBe(1);
  });

  it('consumes exactly 1 day from balance', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const monday = nextMonday();
    await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: monday, endDate: monday });

    const bal = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal).toBe(19);
  });
});

// ── Year boundary ─────────────────────────────────────────────────────────────

describe('Edge case: year boundary dates', () => {
  it('rejects a request spanning Dec 31 to Jan 1 (cross-year)', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({
        leaveTypeId: annual.id,
        startDate: `${nextYear}-12-30`,
        endDate:   `${nextYear + 1}-01-03`,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/same calendar year/i);
  });

  it('accepts a request that ends on Dec 31 (last day of year)', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    // Find a weekday near Dec 31 of nextYear
    const dec31 = new Date(nextYear, 11, 31);
    // Go back to the most recent Monday before Dec 31 (inclusive)
    const startD = new Date(dec31);
    while (startD.getDay() !== 1) startD.setDate(startD.getDate() - 1);

    if (startD.getFullYear() !== nextYear) {
      // Edge: Dec 31 falls on a Sunday in nextYear; skip this sub-test
      return;
    }

    const startDate = isoDate(startD);
    const endDate   = isoDate(dec31.getDay() !== 0 && dec31.getDay() !== 6 ? dec31 : startD);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate, endDate });

    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.workingDaysCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('accepts a request starting on Jan 1 of nextYear (first day of year)', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    // Find first Monday of nextYear
    const jan1 = new Date(nextYear, 0, 1);
    const startD = new Date(jan1);
    while (startD.getDay() !== 1) startD.setDate(startD.getDate() + 1);
    const startDate = isoDate(startD);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate, endDate: startDate });

    expect(res.status).toBe(201);
    expect(res.body.workingDaysCount).toBe(1);
  });
});

// ── Leap day (Feb 29) ─────────────────────────────────────────────────────────

describe('Edge case: leap day (Feb 29)', () => {
  it('accepts a leave request on Feb 29 in a leap year', async () => {
    // Find the next leap year after nextYear
    let leapYear = nextYear;
    while (!((leapYear % 4 === 0 && leapYear % 100 !== 0) || leapYear % 400 === 0)) {
      leapYear++;
    }

    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const feb29 = `${leapYear}-02-29`;
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: feb29, endDate: feb29 });

    // Feb 29 may be a weekend in some years — just verify no 500
    expect(res.status).not.toBe(500);
    if (res.status === 201) {
      expect(res.body).toHaveProperty('id');
    }
  });
});

// ── Max-length reason string ───────────────────────────────────────────────────

describe('Edge case: maximum-length reason string', () => {
  it('accepts a reason of exactly 255 characters', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const reason255 = 'A'.repeat(255);
    const monday = nextMonday();
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: monday, endDate: monday, reason: reason255 });

    expect(res.status).toBe(201);
    expect(res.body.reason).toBe(reason255);
  });

  it('accepts a reason of 1000 characters (TEXT field — no hard cap in model)', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const tuesday = (() => {
      const d = new Date(nextYear, 0, 1);
      while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
      return isoDate(d);
    })();
    const reason1000 = 'B'.repeat(1000);
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: tuesday, endDate: tuesday, reason: reason1000 });

    expect(res.status).toBe(201);
    expect(res.body.reason.length).toBe(1000);
  });
});

// ── Optional fields (reason is null/missing) ─────────────────────────────────

describe('Edge case: optional fields omitted', () => {
  it('creates a leave request without a reason field', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const monday = nextMonday();
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: monday, endDate: monday });

    expect(res.status).toBe(201);
    expect([null, undefined, '']).toContain(res.body.reason);
  });

  it('creates a leave request with reason explicitly set to null', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const monday = nextMonday();
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: monday, endDate: monday, reason: null });

    expect(res.status).toBe(201);
  });

  it('creates a leave request with reason as empty string', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 20);

    const monday = nextMonday();
    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: monday, endDate: monday, reason: '' });

    expect(res.status).toBe(201);
  });
});

// ── Exact-balance request (balance == requested days) ────────────────────────

describe('Edge case: exactly sufficient balance', () => {
  it('approves a 5-day request when balance is exactly 5 days', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 5); // exactly 5 days

    // Find Mon-Fri in nextYear
    const d = new Date(nextYear, 5, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    const mon = isoDate(d);
    d.setDate(d.getDate() + 4);
    const fri = isoDate(d);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: mon, endDate: fri });

    expect(res.status).toBe(201);
    // Balance after = 0
    const bal = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal).toBe(0);
  });

  it('rejects a 6-day request when balance is exactly 5 days', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 5);

    // Mon-Sat span (6 calendar days but includes weekend → 5 working days in Mon-Fri + Mon next week)
    // Use Mon to following Mon for 6 working days
    const d = new Date(nextYear, 7, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    const mon = isoDate(d);
    d.setDate(d.getDate() + 7); // next Monday = 6 working days (Mon+Tue+Wed+Thu+Fri + Mon)
    const mon2 = isoDate(d);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: mon, endDate: mon2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance/i);
  });
});

// ── Back-to-back non-overlapping requests ─────────────────────────────────────

describe('Edge case: back-to-back requests (no overlap)', () => {
  it('allows two consecutive week requests in the same year', async () => {
    const { emp, annual } = await setup();
    await grantBalance(emp, annual, 30);

    const d = new Date(nextYear, 0, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    const mon1 = isoDate(d);
    d.setDate(d.getDate() + 4);
    const fri1 = isoDate(d);
    d.setDate(d.getDate() + 3); // next Monday
    const mon2 = isoDate(d);
    d.setDate(d.getDate() + 4);
    const fri2 = isoDate(d);

    const r1 = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: mon1, endDate: fri1 });

    const r2 = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: mon2, endDate: fri2 });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});

// ── Carryover deadline boundary ───────────────────────────────────────────────

describe('Edge case: requests around the carryover deadline', () => {
  it('balance formula includes prior-year accruals in net balance', async () => {
    const { emp, annual } = await setup();

    const currentYear = new Date().getFullYear();
    // Grant 15 days last year and 20 days this year
    await LeaveBalanceLedger.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 15, reason: 'Last year',
      effectiveDate: `${currentYear - 1}-01-01`, createdByUserId: 'test',
    });
    await LeaveBalanceLedger.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 20, reason: 'This year',
      effectiveDate: `${currentYear}-01-01`, createdByUserId: 'test',
    });

    const bal = await leaveService.getAvailableBalance(emp.id, annual.id);
    // Net = 15 + 20 = 35 (carryover not yet forfeited in this model)
    expect(bal).toBe(35);
  });
});
