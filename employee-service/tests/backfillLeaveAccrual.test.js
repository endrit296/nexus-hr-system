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

// Associations (mirrors index.js — required for FK constraints in SQLite)
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

const { runBackfill } = require('../scripts/backfillLeaveAccrual');

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR    = CURRENT_YEAR - 1;

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

// Mirror the service's formula so tests don't embed hard-coded tenure math
function expectedAnnual(hireDateStr, year) {
  const jan1Ms  = new Date(`${year}-01-01`).getTime();
  const hireMs  = new Date(hireDateStr).getTime();
  const tenure  = Math.floor((jan1Ms - hireMs) / (365 * 24 * 3600 * 1000));
  return 20 + Math.floor(Math.max(0, tenure) / 5);
}

// ── Suite setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// ── Suite 1: employee hired well before last year → 4 rows ───────────────────

describe(`runBackfill — hired before ${LAST_YEAR} (Case A: 4 rows)`, () => {
  const HIRE_DATE = `${CURRENT_YEAR - 8}-01-01`;
  let annual, sick, emp, summary;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    sick   = types.sick;
    emp = await Employee.create({ firstName: 'Alice', lastName: 'Old', email: 'alice@test.com', hireDate: HIRE_DATE });
    summary = await runBackfill('test');
  });

  afterAll(clearAll);

  it('summary: processed=1, succeeded=1, failed=0', () => {
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('exactly 4 accrual rows total (last-year annual+sick, current-year annual+sick)', async () => {
    const rows = await LeaveBalanceLedger.findAll({ where: { employeeId: emp.id, entryType: 'accrual' } });
    expect(rows).toHaveLength(4);
  });

  it('no entries with effectiveDate before last year', async () => {
    const rows = await LeaveBalanceLedger.findAll({
      where: { employeeId: emp.id, effectiveDate: { $lt: `${LAST_YEAR}-01-01` } },
    });
    expect(rows).toHaveLength(0);
  });

  it(`last-year annual entry on ${LAST_YEAR}-01-01 with correct tenure-based days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', effectiveDate: `${LAST_YEAR}-01-01` },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(expectedAnnual(HIRE_DATE, LAST_YEAR));
  });

  it(`last-year sick entry on ${LAST_YEAR}-01-01 = 20 days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', effectiveDate: `${LAST_YEAR}-01-01` },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(20);
  });

  it(`current-year annual entry on ${CURRENT_YEAR}-01-01 with correct tenure-based days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', effectiveDate: `${CURRENT_YEAR}-01-01` },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(expectedAnnual(HIRE_DATE, CURRENT_YEAR));
  });

  it(`current-year sick entry on ${CURRENT_YEAR}-01-01 = 20 days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', effectiveDate: `${CURRENT_YEAR}-01-01` },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(20);
  });

  it('ledger_entries_written matches actual row count', async () => {
    const total = await LeaveBalanceLedger.count();
    expect(summary.ledger_entries_written).toBe(total);
  });
});

// ── Suite 2: employee hired during last year → 4 rows ────────────────────────

describe(`runBackfill — hired during ${LAST_YEAR} (Case B: 4 rows)`, () => {
  const HIRE_DATE = `${LAST_YEAR}-05-01`;
  let annual, sick, emp, summary;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    sick   = types.sick;
    emp = await Employee.create({ firstName: 'Bob', lastName: 'Mid', email: 'bob@test.com', hireDate: HIRE_DATE });
    summary = await runBackfill('test');
  });

  afterAll(clearAll);

  it('summary: processed=1, succeeded=1, failed=0', () => {
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('exactly 4 accrual rows (pro-rated last year + full current year)', async () => {
    const rows = await LeaveBalanceLedger.findAll({ where: { employeeId: emp.id, entryType: 'accrual' } });
    expect(rows).toHaveLength(4);
  });

  it(`last-year annual entry is on hire_date (${HIRE_DATE}), pro-rated (> 0 and < 20)`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', effectiveDate: HIRE_DATE },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBeGreaterThan(0);
    expect(parseFloat(entry.days)).toBeLessThan(20);
  });

  it(`last-year sick entry is on hire_date (${HIRE_DATE}) = 20 days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', effectiveDate: HIRE_DATE },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(20);
  });

  it(`current-year annual entry on ${CURRENT_YEAR}-01-01 = 20 days (< 5 years tenure)`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', effectiveDate: `${CURRENT_YEAR}-01-01` },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(expectedAnnual(HIRE_DATE, CURRENT_YEAR));
  });

  it(`current-year sick entry on ${CURRENT_YEAR}-01-01 = 20 days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', effectiveDate: `${CURRENT_YEAR}-01-01` },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(20);
  });
});

// ── Suite 3: employee hired during current year → 2 rows ─────────────────────

describe(`runBackfill — hired during ${CURRENT_YEAR} (Case C: 2 rows)`, () => {
  const HIRE_DATE = `${CURRENT_YEAR}-03-01`;
  let annual, sick, emp, summary;

  beforeAll(async () => {
    const types = await createLeaveTypes();
    annual = types.annual;
    sick   = types.sick;
    emp = await Employee.create({ firstName: 'Carol', lastName: 'New', email: 'carol@test.com', hireDate: HIRE_DATE });
    summary = await runBackfill('test');
  });

  afterAll(clearAll);

  it('summary: processed=1, succeeded=1, failed=0', () => {
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('exactly 2 accrual rows (pro-rated current year only)', async () => {
    const rows = await LeaveBalanceLedger.findAll({ where: { employeeId: emp.id, entryType: 'accrual' } });
    expect(rows).toHaveLength(2);
  });

  it(`annual entry is on hire_date (${HIRE_DATE}), pro-rated (> 0 and < 20)`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: annual.id, entryType: 'accrual', effectiveDate: HIRE_DATE },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBeGreaterThan(0);
    expect(parseFloat(entry.days)).toBeLessThan(20);
  });

  it(`sick entry is on hire_date (${HIRE_DATE}) = 20 days`, async () => {
    const entry = await LeaveBalanceLedger.findOne({
      where: { employeeId: emp.id, leaveTypeId: sick.id, entryType: 'accrual', effectiveDate: HIRE_DATE },
    });
    expect(entry).not.toBeNull();
    expect(parseFloat(entry.days)).toBe(20);
  });

  it('no entries with effectiveDate before current year', async () => {
    const rows = await LeaveBalanceLedger.findAll({
      where: { employeeId: emp.id, effectiveDate: { $lt: `${CURRENT_YEAR}-01-01` } },
    });
    expect(rows).toHaveLength(0);
  });
});

// ── Suite 4: null hire_date employee is skipped gracefully ───────────────────

describe('runBackfill — null hire_date skipped gracefully', () => {
  let nullEmp, goodEmp, summary;

  beforeAll(async () => {
    await createLeaveTypes();
    goodEmp  = await Employee.create({ firstName: 'Dave', lastName: 'Good', email: 'dave@test.com', hireDate: `${LAST_YEAR}-06-01` });
    nullEmp  = await Employee.create({ firstName: 'Eve',  lastName: 'Bad',  email: 'eve@test.com',  hireDate: null });
    summary  = await runBackfill('test');
  });

  afterAll(clearAll);

  it('processed = 2 (both employees)', () => {
    expect(summary.processed).toBe(2);
  });

  it('succeeded = 1 (the valid employee)', () => {
    expect(summary.succeeded).toBe(1);
  });

  it('failed = 1 (the null-hire_date employee)', () => {
    expect(summary.failed).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0].employee_id).toBe(nullEmp.id);
    expect(summary.failures[0].error).toMatch(/hire_date/i);
  });

  it('null-hire_date employee has no ledger entries', async () => {
    const rows = await LeaveBalanceLedger.findAll({ where: { employeeId: nullEmp.id } });
    expect(rows).toHaveLength(0);
  });

  it('valid employee received their ledger entries', async () => {
    const rows = await LeaveBalanceLedger.findAll({ where: { employeeId: goodEmp.id } });
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── Suite 5: safety guard aborts if consumption entries exist ─────────────────

describe('runBackfill — aborts when consumption entries exist', () => {
  let emp;

  beforeAll(async () => {
    const { annual } = await createLeaveTypes();
    emp = await Employee.create({ firstName: 'Frank', lastName: 'Safe', email: 'frank@test.com', hireDate: `${LAST_YEAR}-01-01` });
    // Simulate a consumption entry already present
    await LeaveBalanceLedger.create({
      employeeId:      emp.id,
      leaveTypeId:     annual.id,
      entryType:       'consumption',
      days:            -3,
      reason:          'Leave consumed',
      effectiveDate:   `${LAST_YEAR}-02-01`,
      createdByUserId: 'test',
    });
  });

  afterAll(clearAll);

  it('throws with the abort message', async () => {
    await expect(runBackfill('test')).rejects.toThrow(
      'Aborting: consumption entries exist. Manual review required before re-running backfill.'
    );
  });

  it('leaves the existing ledger row intact (no DELETE occurred)', async () => {
    const count = await LeaveBalanceLedger.count();
    expect(count).toBe(1);
  });
});
