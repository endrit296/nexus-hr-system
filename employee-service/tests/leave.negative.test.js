// Negative input tests for leave request endpoints.
// Covers malformed JSON, wrong types, missing required fields, non-existent
// foreign keys, deleted employees, and invalid date combinations.

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

async function createEmployeeAndType() {
  const manager = await Employee.create({ firstName: 'Boss', lastName: 'Man', email: 'boss@neg.com' });
  const emp     = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@neg.com', managerId: manager.id });
  const annual  = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
  return { manager, emp, annual };
}

const nextYear = new Date().getFullYear() + 1;

function nextWorkday(month = 5) {
  const d = new Date(nextYear, month, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

// ── Missing required fields ───────────────────────────────────────────────────

describe('POST /leave-requests — missing required fields', () => {
  it('returns 400 when leaveTypeId is missing', async () => {
    const { emp } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ startDate: day, endDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when startDate is missing', async () => {
    const { emp, annual } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, endDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when endDate is missing', async () => {
    const { emp, annual } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when all required fields are missing', async () => {
    const { emp } = await createEmployeeAndType();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── Wrong types ───────────────────────────────────────────────────────────────

describe('POST /leave-requests — wrong field types', () => {
  it('returns 400 when leaveTypeId is a non-numeric string', async () => {
    const { emp } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: 'annual', startDate: day, endDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when leaveTypeId is a float (non-integer)', async () => {
    const { emp } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: 1.5, startDate: day, endDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when leaveTypeId is zero', async () => {
    const { emp } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: 0, startDate: day, endDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when leaveTypeId is negative', async () => {
    const { emp } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: -1, startDate: day, endDate: day });
    expect(res.status).toBe(400);
  });

  it('returns 400 when startDate is not an ISO date string', async () => {
    const { emp, annual } = await createEmployeeAndType();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: 'not-a-date', endDate: nextWorkday() });
    expect(res.status).toBe(400);
  });

  it('returns 400 when startDate is a number instead of string', async () => {
    const { emp, annual } = await createEmployeeAndType();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: 20250601, endDate: nextWorkday() });
    expect(res.status).toBe(400);
  });

  it('returns 400 when endDate uses DD/MM/YYYY format instead of ISO', async () => {
    const { emp, annual } = await createEmployeeAndType();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: nextWorkday(), endDate: '01/06/2025' });
    expect(res.status).toBe(400);
  });
});

// ── end_date before start_date ────────────────────────────────────────────────

describe('POST /leave-requests — end_date before start_date', () => {
  it('returns 400 when endDate is 1 day before startDate', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await LeaveBalanceLedger.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 20, reason: 'test',
      effectiveDate: '2025-01-01', createdByUserId: 'test',
    });
    const start = `${nextYear}-06-05`;
    const end   = `${nextYear}-06-04`;
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: start, endDate: end });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end_date/i);
  });
});

// ── Non-existent leave type ───────────────────────────────────────────────────

describe('POST /leave-requests — non-existent leaveTypeId', () => {
  it('returns 4xx when leaveTypeId does not exist in database', async () => {
    const { emp } = await createEmployeeAndType();
    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: 99999, startDate: day, endDate: day });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ── Soft-deleted employee ─────────────────────────────────────────────────────

describe('POST /leave-requests — soft-deleted employee', () => {
  it('returns 404 when the employee record has been soft-deleted', async () => {
    const { emp, annual } = await createEmployeeAndType();
    // Soft-delete the employee
    await emp.destroy();

    const day = nextWorkday();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: day, endDate: day });

    expect(res.status).toBe(404);
  });
});

// ── Malformed JSON body ───────────────────────────────────────────────────────

describe('POST /leave-requests — malformed JSON', () => {
  it('returns 400 for malformed JSON with content-type application/json', async () => {
    const { emp } = await createEmployeeAndType();
    const res = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee', 'Content-Type': 'application/json' })
      .send('{ not valid json }');
    expect(res.status).toBe(400);
  });
});

// ── Approve/reject on non-existent request ────────────────────────────────────

describe('POST /leave-requests/:id/approve — non-existent request', () => {
  it('returns 404 when request ID does not exist', async () => {
    const { manager } = await createEmployeeAndType();
    const res = await request(app)
      .post('/leave-requests/99999/approve')
      .set({ 'x-user-email': manager.email, 'x-user-role': 'manager' })
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /leave-requests/:id/reject — missing decision_note', () => {
  it('returns 400 when decisionNote is missing', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await LeaveBalanceLedger.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 20, reason: 'test',
      effectiveDate: `${nextYear}-01-01`, createdByUserId: 'test',
    });

    const day = nextWorkday();
    const r = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' })
      .send({ leaveTypeId: annual.id, startDate: day, endDate: day });
    expect(r.status).toBe(201);

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/reject`)
      .set({ 'x-user-email': manager.email, 'x-user-role': 'manager' })
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/decision_note/i);
  });
});
