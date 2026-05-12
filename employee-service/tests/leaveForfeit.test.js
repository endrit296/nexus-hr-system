jest.mock('../config/database', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  return { sequelize, connectDB: async () => {} };
});

jest.mock('../cache',        () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() }));
jest.mock('../messenger',    () => ({ sendToQueue: jest.fn().mockResolvedValue(true) }));
jest.mock('../logger',       () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('node-schedule',   () => ({ scheduleJob: jest.fn() }));

const { sequelize }      = require('../config/database');
const Employee           = require('../models/Employee');
const LeaveType          = require('../models/LeaveType');
const LeaveBalanceLedger = require('../models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('../models/LeaveRequestAudit');
const LeaveRequest       = require('../models/LeaveRequest');

// Associations
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',       onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee,   { foreignKey: 'managerId', as: 'subordinates',  onDelete: 'SET NULL', hooks: true });
Employee.hasMany(LeaveBalanceLedger, { foreignKey: 'employeeId', as: 'ledgerEntries', onDelete: 'RESTRICT' });
LeaveBalanceLedger.belongsTo(Employee,  { foreignKey: 'employeeId', as: 'employee',     onDelete: 'RESTRICT' });
LeaveType.hasMany(LeaveBalanceLedger,   { foreignKey: 'leaveTypeId', as: 'ledgerEntries' });
LeaveBalanceLedger.belongsTo(LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
Employee.hasMany(LeaveRequest,        { foreignKey: 'employeeId',  as: 'leaveRequests' });
LeaveRequest.belongsTo(Employee,      { foreignKey: 'employeeId',  as: 'employee' });
LeaveType.hasMany(LeaveRequest,       { foreignKey: 'leaveTypeId', as: 'requests' });
LeaveRequest.belongsTo(LeaveType,     { foreignKey: 'leaveTypeId', as: 'leaveType' });
LeaveRequest.hasMany(LeaveBalanceLedger,   { foreignKey: 'relatedRequestId', as: 'ledgerEntries' });
LeaveBalanceLedger.belongsTo(LeaveRequest, { foreignKey: 'relatedRequestId', as: 'request' });
LeaveRequest.hasMany(LeaveRequestAudit,    { foreignKey: 'requestId', as: 'auditEntries' });
LeaveRequestAudit.belongsTo(LeaveRequest,  { foreignKey: 'requestId', as: 'request' });

const leaveService = require('../application/services/LeaveService');

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR    = CURRENT_YEAR - 1;
const JUL1         = `${CURRENT_YEAR}-07-01`;
const JAN1         = `${CURRENT_YEAR}-01-01`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createLeaveTypes() {
  const annual = await LeaveType.findOrCreate({ where: { code: 'annual' }, defaults: { name: 'Annual Leave', isPaid: true } });
  const sick   = await LeaveType.findOrCreate({ where: { code: 'sick'   }, defaults: { name: 'Sick Leave',   isPaid: true, requiresProofAfterDays: 3, maxRetroactiveDays: 7 } });
  return { annual: annual[0], sick: sick[0] };
}

async function clearAll() {
  await LeaveRequestAudit.destroy({ where: {} });
  await LeaveBalanceLedger.destroy({ where: {} });
  await LeaveRequest.destroy({ where: {} });
  await Employee.destroy({ where: {}, force: true });
  await LeaveType.destroy({ where: {} });
}

async function netBalance(empId, ltId) {
  const rows = await LeaveBalanceLedger.findAll({ where: { employeeId: empId, leaveTypeId: ltId } });
  return rows.reduce((sum, r) => sum + parseFloat(r.days), 0);
}

// ── Suite setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// ── Suite 1: carryover forfeited when balance exceeds current-year allotment ──

describe('processYearlyForfeit — forfeits carryover (no consumption this year)', () => {
  // Scenario: 10 days accrued from last year + 20 from this year = 30 total.
  // Allotment = 20, consumed this year = 0, target = 20.
  // Expected adjustment = 20 - 30 = -10.
  let annual, emp;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    emp = await Employee.create({ firstName: 'Ann', lastName: 'One', email: 'ann@test.com', hireDate: `${LAST_YEAR}-01-01` });

    // 10 days from last year, 20 days from current year
    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', days: 10, reason: 'Last year accrual', effectiveDate: `${LAST_YEAR}-01-01`, createdByUserId: 'test' });
    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', days: 20, reason: 'Current year accrual', effectiveDate: JAN1, createdByUserId: 'test' });

    await leaveService.processYearlyForfeit(new Date(JUL1));
  });

  afterAll(clearAll);

  it('writes exactly one adjustment entry', async () => {
    const adj = await LeaveBalanceLedger.findAll({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' },
    });
    expect(adj).toHaveLength(1);
  });

  it('adjustment days = -10 (forfeits the 10-day carryover)', async () => {
    const adj = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' },
    });
    expect(parseFloat(adj.days)).toBe(-10);
  });

  it('adjustment effective_date = Jul 1 of current year', async () => {
    const adj = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' },
    });
    expect(adj.effectiveDate).toBe(JUL1);
  });

  it('net balance after forfeit = 20 (current-year allotment)', async () => {
    expect(await netBalance(emp.id, annual.id)).toBe(20);
  });
});

// ── Suite 2: forfeit accounts for consumption taken in current year ───────────

describe('processYearlyForfeit — consumption this year reduces target', () => {
  // Scenario: 15 days accrued last year + 20 this year − 5 consumed this year = net 30.
  // Allotment = 20, consumed this year = 5, target = max(0, 20-5) = 15.
  // Expected adjustment = 15 - 30 = -15.
  let annual, emp;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    emp = await Employee.create({ firstName: 'Ben', lastName: 'Two', email: 'ben@test.com', hireDate: `${LAST_YEAR}-01-01` });

    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual',     days:  15, reason: 'Last year accrual',    effectiveDate: `${LAST_YEAR}-01-01`,  createdByUserId: 'test' });
    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual',     days:  20, reason: 'Current year accrual', effectiveDate: JAN1,                  createdByUserId: 'test' });
    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'consumption', days:  -5, reason: 'Leave consumed',        effectiveDate: `${CURRENT_YEAR}-03-01`, createdByUserId: 'test' });

    await leaveService.processYearlyForfeit(new Date(JUL1));
  });

  afterAll(clearAll);

  it('writes exactly one adjustment entry', async () => {
    const adj = await LeaveBalanceLedger.findAll({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' },
    });
    expect(adj).toHaveLength(1);
  });

  it('adjustment days = -15', async () => {
    const adj = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' },
    });
    expect(parseFloat(adj.days)).toBe(-15);
  });

  it('net balance after forfeit = 15 (allotment minus consumption)', async () => {
    expect(await netBalance(emp.id, annual.id)).toBe(15);
  });
});

// ── Suite 3: sick leave forfeit follows the same rule ─────────────────────────

describe('processYearlyForfeit — sick leave carryover forfeited', () => {
  // Scenario: 5 days carried over from last year + 20 this year = 25 total.
  // Sick allotment = 20, consumption = 0, target = 20.
  // Expected adjustment = 20 - 25 = -5.
  let sick, emp;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    sick = types.sick;
    emp = await Employee.create({ firstName: 'Clara', lastName: 'Three', email: 'clara@test.com', hireDate: `${LAST_YEAR}-01-01` });

    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', days:  5, reason: 'Last year sick accrual',    effectiveDate: `${LAST_YEAR}-01-01`, createdByUserId: 'test' });
    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', days: 20, reason: 'Current year sick accrual', effectiveDate: JAN1,                 createdByUserId: 'test' });

    await leaveService.processYearlyForfeit(new Date(JUL1));
  });

  afterAll(clearAll);

  it('writes exactly one sick adjustment entry', async () => {
    const adj = await LeaveBalanceLedger.findAll({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'adjustment' },
    });
    expect(adj).toHaveLength(1);
  });

  it('adjustment days = -5', async () => {
    const adj = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'adjustment' },
    });
    expect(parseFloat(adj.days)).toBe(-5);
  });

  it('net sick balance after forfeit = 20', async () => {
    expect(await netBalance(emp.id, sick.id)).toBe(20);
  });
});

// ── Suite 4: idempotency — second run on same date writes no new adjustments ──

describe('processYearlyForfeit — idempotent on same date', () => {
  let annual, emp, countAfterFirst, countAfterSecond;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    emp = await Employee.create({ firstName: 'Dan', lastName: 'Four', email: 'dan@test.com', hireDate: `${LAST_YEAR}-01-01` });

    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', days: 10, reason: 'Last year',    effectiveDate: `${LAST_YEAR}-01-01`, createdByUserId: 'test' });
    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', days: 20, reason: 'Current year', effectiveDate: JAN1,                 createdByUserId: 'test' });

    await leaveService.processYearlyForfeit(new Date(JUL1));
    countAfterFirst = await LeaveBalanceLedger.count({ where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' } });

    await leaveService.processYearlyForfeit(new Date(JUL1));
    countAfterSecond = await LeaveBalanceLedger.count({ where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' } });
  });

  afterAll(clearAll);

  it('first run writes 1 adjustment', () => {
    expect(countAfterFirst).toBe(1);
  });

  it('second run on the same date adds no new adjustments', () => {
    expect(countAfterSecond).toBe(1);
  });
});

// ── Suite 5: no adjustment when balance does not exceed allotment ─────────────

describe('processYearlyForfeit — no adjustment when balance ≤ allotment', () => {
  // Scenario: only the current-year allotment of 20 days, no carryover.
  // Net balance = 20, allotment = 20, target = 20, adjustment = 0 — nothing written.
  let annual, emp;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    emp = await Employee.create({ firstName: 'Eve', lastName: 'Five', email: 'eve@test.com', hireDate: `${CURRENT_YEAR}-01-01` });

    await LeaveBalanceLedger.create({ employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', days: 20, reason: 'Current year accrual', effectiveDate: JAN1, createdByUserId: 'test' });

    await leaveService.processYearlyForfeit(new Date(JUL1));
  });

  afterAll(clearAll);

  it('writes no adjustment entry', async () => {
    const adj = await LeaveBalanceLedger.findAll({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'adjustment' },
    });
    expect(adj).toHaveLength(0);
  });

  it('net balance is still 20', async () => {
    expect(await netBalance(emp.id, annual.id)).toBe(20);
  });
});
