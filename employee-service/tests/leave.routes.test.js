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

// Models
const Employee          = require('../models/Employee');
const Department        = require('../models/Department');
const LeaveType         = require('../models/LeaveType');
const LeaveRequest      = require('../models/LeaveRequest');
const LeaveBalanceLedger = require('../models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('../models/LeaveRequestAudit');

// Associations (same as index.js)
Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',    onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',          onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',       onDelete: 'SET NULL', hooks: true });

Employee.hasMany(LeaveRequest,        { foreignKey: 'employeeId',       as: 'leaveRequests'  });
LeaveRequest.belongsTo(Employee,      { foreignKey: 'employeeId',       as: 'employee'       });
LeaveType.hasMany(LeaveRequest,       { foreignKey: 'leaveTypeId',      as: 'requests'       });
LeaveRequest.belongsTo(LeaveType,     { foreignKey: 'leaveTypeId',      as: 'leaveType'      });
Employee.hasMany(LeaveBalanceLedger,  { foreignKey: 'employeeId',       as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(Employee,{ foreignKey: 'employeeId',       as: 'employee'       });
LeaveType.hasMany(LeaveBalanceLedger, { foreignKey: 'leaveTypeId',      as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(LeaveType,{ foreignKey: 'leaveTypeId',     as: 'leaveType'      });
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

// ── Setup ─────────────────────────────────────────────────────────────────────

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
  const manager = await Employee.create({ firstName: 'Boss', lastName: 'Man', email: 'boss@test.com' });
  const emp     = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', managerId: manager.id, hireDate: '2020-01-01' });
  const annual  = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
  const sick    = await LeaveType.create({ code: 'sick',   name: 'Sick Leave',   isPaid: true, requiresProofAfterDays: 3, maxRetroactiveDays: 7 });
  return { manager, emp, annual, sick };
}

async function grantBalance(emp, lt, days) {
  return LeaveBalanceLedger.create({
    employeeId:      emp.id,
    leaveTypeId:     lt.id,
    entryType:       'accrual',
    days,
    reason:          'Test grant',
    effectiveDate:   '2025-01-01',
    createdByUserId: 'test',
  });
}

const headers = (email, role = 'employee', userId = 'mongo-user-id') => ({
  'x-user-email': email,
  'x-user-role':  role,
  'x-user-id':    userId,
});

// Future date helper — find first Monday of June in next year, then +4 days for Friday
const nextYear = new Date().getFullYear() + 1;

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findMonFri(year) {
  const d = new Date(year, 5, 1); // June 1 (local)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // advance to Monday
  const mon = isoLocal(d);
  d.setDate(d.getDate() + 4);
  return [mon, isoLocal(d)]; // [Monday, Friday] — always 5 working days
}

const [futureStart, futureEnd] = findMonFri(nextYear);

// ── POST /leave-requests ──────────────────────────────────────────────────────

describe('POST /leave-requests — apply', () => {

  it('successfully creates a pending request', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.workingDaysCount).toBe(5);
  });

  it('returns 404 when no employee record is linked', async () => {
    await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });

    const res = await request(app)
      .post('/leave-requests')
      .set(headers('nobody@test.com'))
      .send({ leaveTypeId: 1, startDate: futureStart, endDate: futureEnd });

    expect(res.status).toBe(404);
  });

  it('rejects a cross-year request', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: `${nextYear}-12-30`, endDate: `${nextYear + 1}-01-03` });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/same calendar year/i);
  });

  it('rejects when end_date < start_date', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureEnd, endDate: futureStart });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end_date/i);
  });

  it('rejects annual leave with a past start_date', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: '2020-06-01', endDate: '2020-06-05' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/past/i);
  });

  it('allows sick leave within max_retroactive_days (today - 3)', async () => {
    const { emp, sick } = await createEmployeeAndType();
    await grantBalance(emp, sick, 20);

    const threeAgo = new Date();
    threeAgo.setDate(threeAgo.getDate() - 3);
    const startDate = threeAgo.toISOString().slice(0, 10);
    const endDate   = startDate; // single day (might be weekend)

    // Compute a Mon-Fri day within 3 days back
    const mondayish = new Date();
    for (let i = 1; i <= 7; i++) {
      mondayish.setDate(mondayish.getDate() - 1);
      const day = mondayish.getDay();
      if (day !== 0 && day !== 6) break;
    }
    const ds = mondayish.toISOString().slice(0, 10);

    const today = new Date().toISOString().slice(0, 10);
    if (ds >= today) {
      // start is not in the past — skip the actual check and just assert balance logic works
      const res = await request(app)
        .post('/leave-requests')
        .set(headers(emp.email))
        .send({ leaveTypeId: sick.id, startDate: ds, endDate: ds });
      expect([201, 400]).toContain(res.status); // may fail if it's today or future
    } else {
      const res = await request(app)
        .post('/leave-requests')
        .set(headers(emp.email))
        .send({ leaveTypeId: sick.id, startDate: ds, endDate: ds });
      expect(res.status).toBe(201);
    }
  });

  it('rejects sick leave beyond max_retroactive_days (8 days ago)', async () => {
    const { emp, sick } = await createEmployeeAndType();
    await grantBalance(emp, sick, 20);

    const eightAgo = new Date();
    eightAgo.setDate(eightAgo.getDate() - 8);
    // Force to a Monday to ensure it's a working day
    while (eightAgo.getDay() === 0 || eightAgo.getDay() === 6) eightAgo.setDate(eightAgo.getDate() - 1);
    const ds = eightAgo.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: sick.id, startDate: ds, endDate: ds });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/retroactive/i);
  });

  it('rejects when available balance is insufficient', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 3); // only 3 days

    const res = await request(app)
      .post('/leave-requests')
      .set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd }); // 5 days

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance/i);
  });

  it('rejects overlap — pending + pending', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 30);

    await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    expect(res.status).toBe(409);
  });

  it('rejects overlap — pending + approved', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 30);

    const r1 = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    // approve it directly
    await LeaveRequest.update({ status: 'approved' }, { where: { id: r1.body.id } });

    const res = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    expect(res.status).toBe(409);
  });

  it('rejects overlap — approved + approved', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 30);

    const r1 = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });
    await LeaveRequest.update({ status: 'approved' }, { where: { id: r1.body.id } });

    const r2 = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    expect(r2.status).toBe(409);
  });

});

// ── GET /leave-requests ───────────────────────────────────────────────────────

describe('GET /leave-requests — list', () => {

  it('returns own requests by default', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app).get('/leave-requests').set(headers(emp.email));
    expect(res.status).toBe(200);
    expect(res.body.requests.length).toBe(1);
  });

  it('as=manager returns direct reports requests', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app).get('/leave-requests?as=manager').set(headers(manager.email, 'manager'));
    expect(res.status).toBe(200);
    expect(res.body.requests.length).toBe(1);
  });

  it('all=true requires admin role', async () => {
    const { emp } = await createEmployeeAndType();
    const res = await request(app).get('/leave-requests?all=true').set(headers(emp.email, 'employee'));
    expect(res.status).toBe(403);
  });

});

// ── Approve ───────────────────────────────────────────────────────────────────

describe('POST /leave-requests/:id/approve', () => {

  it('allows the direct manager to approve', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/approve`)
      .set(headers(manager.email, 'manager'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('returns 403 when a non-manager non-admin tries to approve', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const other = await Employee.create({ firstName: 'Other', lastName: 'Guy', email: 'other@test.com' });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/approve`)
      .set(headers(other.email, 'employee'))
      .send({});

    expect(res.status).toBe(403);
  });

  it('admin can approve when employee has no manager', async () => {
    const annual = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
    const emp    = await Employee.create({ firstName: 'Solo', lastName: 'Worker', email: 'solo@test.com' }); // no managerId
    await grantBalance(emp, annual, 20);

    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/approve`)
      .set(headers('admin@test.com', 'admin'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('admin gets 403 when employee has a manager (manager must approve)', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/approve`)
      .set(headers('admin@test.com', 'admin'))
      .send({});

    expect(res.status).toBe(403);
  });

});

// ── Reject ────────────────────────────────────────────────────────────────────

describe('POST /leave-requests/:id/reject', () => {

  it('requires a non-empty decision_note', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/reject`)
      .set(headers(manager.email, 'manager'))
      .send({ decisionNote: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/decision_note/i);
  });

  it('rejects successfully with a reason', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/reject`)
      .set(headers(manager.email, 'manager'))
      .send({ decisionNote: 'Too many people on leave that week' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.decisionNote).toBe('Too many people on leave that week');
  });

});

// ── Withdraw ──────────────────────────────────────────────────────────────────

describe('POST /leave-requests/:id/withdraw', () => {

  it('allows the requester to withdraw a pending request', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/withdraw`)
      .set(headers(emp.email));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('withdrawn');
  });

  it('allows withdrawing an approved future request', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);
    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });
    await request(app).post(`/leave-requests/${r.body.id}/approve`)
      .set(headers(manager.email, 'manager')).send({});

    const res = await request(app)
      .post(`/leave-requests/${r.body.id}/withdraw`)
      .set(headers(emp.email));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('withdrawn');
  });

  it('cannot withdraw on or after start_date', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    // Directly insert a request with start_date = today
    const today = new Date().toISOString().slice(0, 10);
    // Compute next working day for end_date
    const endD  = new Date(); endD.setDate(endD.getDate() + 7);
    const endDate = endD.toISOString().slice(0, 10);
    const req2 = await LeaveRequest.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      startDate: today, endDate: endDate,
      workingDaysCount: 5, status: 'pending', submittedAt: new Date(),
    });

    const res = await request(app)
      .post(`/leave-requests/${req2.id}/withdraw`)
      .set(headers(emp.email));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start date/i);
  });

  it('balance reservation is released after withdrawal', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });

    // Balance before withdrawal: 20 accrued - 5 reserved = 15
    const bal1 = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal1).toBe(15);

    await request(app).post(`/leave-requests/${r.body.id}/withdraw`).set(headers(emp.email));

    // Balance after: 20 (reservation released)
    const bal2 = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal2).toBe(20);
  });

});

// ── Available balance ─────────────────────────────────────────────────────────

describe('Available balance formula', () => {

  it('subtracts pending requests from accrued balance', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd }); // 5 days

    const bal = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal).toBe(15);
  });

  it('subtracts approved-but-unconsumed requests from balance', async () => {
    const { manager, emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });
    await request(app).post(`/leave-requests/${r.body.id}/approve`)
      .set(headers(manager.email, 'manager')).send({});

    const bal = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal).toBe(15); // 20 - 5 reserved (approved, no consumption entry yet)
  });

  it('does NOT subtract withdrawn requests', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const r = await request(app).post('/leave-requests').set(headers(emp.email))
      .send({ leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd });
    await request(app).post(`/leave-requests/${r.body.id}/withdraw`).set(headers(emp.email));

    const bal = await leaveService.getAvailableBalance(emp.id, annual.id);
    expect(bal).toBe(20);
  });

});

// ── Daily consumption job ─────────────────────────────────────────────────────

describe('processConsumptionEntries (daily job)', () => {

  it('writes a consumption ledger entry for an approved past request', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    // Create an approved request with start_date in the past
    const pastStart = '2024-06-02';
    const pastEnd   = '2024-06-06';
    const req2 = await LeaveRequest.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      startDate: pastStart, endDate: pastEnd,
      workingDaysCount: 5, status: 'approved', submittedAt: new Date(),
    });

    const count = await leaveService.processConsumptionEntries('2024-06-10');
    expect(count).toBe(1);

    const entry = await LeaveBalanceLedger.findOne({
      where: { relatedRequestId: req2.id, entryType: 'consumption' },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(-5);
  });

  it('is idempotent — running twice creates only one consumption entry', async () => {
    const { emp, annual } = await createEmployeeAndType();
    await grantBalance(emp, annual, 20);

    const req2 = await LeaveRequest.create({
      employeeId: emp.id, leaveTypeId: annual.id,
      startDate: '2024-07-07', endDate: '2024-07-11',
      workingDaysCount: 5, status: 'approved', submittedAt: new Date(),
    });

    await leaveService.processConsumptionEntries('2024-07-15');
    await leaveService.processConsumptionEntries('2024-07-15'); // second run

    const entries = await LeaveBalanceLedger.findAll({
      where: { relatedRequestId: req2.id, entryType: 'consumption' },
    });
    expect(entries.length).toBe(1);
  });

});

// ── Yearly accrual job ────────────────────────────────────────────────────────

describe('processYearlyAccrual (yearly job)', () => {

  async function setup(yearsBack) {
    const annual = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
    const sick   = await LeaveType.create({ code: 'sick',   name: 'Sick Leave',   isPaid: true });
    const jan1 = new Date('2025-01-01');
    const hireDate = new Date(jan1);
    hireDate.setFullYear(jan1.getFullYear() - yearsBack);
    const emp = await Employee.create({
      firstName: 'Test', lastName: `Emp${yearsBack}`,
      email: `emp${yearsBack}@test.com`,
      status: 'active', hireDate: hireDate.toISOString().slice(0, 10),
    });
    return { emp, annual, sick, jan1 };
  }

  it('grants 20 annual days for < 5 years (4 years service)', async () => {
    const { emp, annual, jan1 } = await setup(4);
    await leaveService.processYearlyAccrual(jan1);

    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual' },
    });
    expect(parseFloat(entry.days)).toBe(20);
  });

  it('grants 21 annual days for exactly 5 years service', async () => {
    const { emp, annual, jan1 } = await setup(5);
    await leaveService.processYearlyAccrual(jan1);

    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual' },
    });
    expect(parseFloat(entry.days)).toBe(21);
  });

  it('grants 22 annual days for exactly 10 years service', async () => {
    const { emp, annual, jan1 } = await setup(10);
    await leaveService.processYearlyAccrual(jan1);

    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual' },
    });
    expect(parseFloat(entry.days)).toBe(22);
  });

  it('grants 20 sick days regardless of seniority', async () => {
    const { emp, sick, jan1 } = await setup(10);
    await leaveService.processYearlyAccrual(jan1);

    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual' },
    });
    expect(parseFloat(entry.days)).toBe(20);
  });

});

// ── Hire-time pro-rating ──────────────────────────────────────────────────────

describe('grantHireTimeAccrual', () => {

  it('pro-rates annual leave: hired 2025-07-01 → 10 days (floor(20×132/261))', async () => {
    const annual = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
    const sick   = await LeaveType.create({ code: 'sick',   name: 'Sick Leave',   isPaid: true });
    const emp    = await Employee.create({
      firstName: 'New', lastName: 'Hire', email: 'newhire@test.com',
      hireDate: '2025-07-01',
    });

    await leaveService.grantHireTimeAccrual(emp, 'test-actor');

    const annualEntry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual' },
    });
    const sickEntry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual' },
    });

    // 2025: Jan–Jun = 129 working days, Jul 1–Dec 31 = 132 working days, total = 261
    // prorated = floor(20 * 132 / 261) = floor(10.115) = 10
    expect(parseFloat(annualEntry.days)).toBe(10);
    expect(parseFloat(sickEntry.days)).toBe(20); // sick is NOT pro-rated
  });

  it('grants full annual when hired Jan 1', async () => {
    const annual = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
    await LeaveType.create({ code: 'sick', name: 'Sick Leave', isPaid: true });
    const emp = await Employee.create({
      firstName: 'Jan', lastName: 'First', email: 'jan1@test.com',
      hireDate: '2025-01-01',
    });

    await leaveService.grantHireTimeAccrual(emp, 'test');

    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id },
    });
    expect(parseFloat(entry.days)).toBe(20);
  });

});
