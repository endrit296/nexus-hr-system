// Schema-level tests for leave management data model.
// Tests run against an in-memory SQLite database — no real Postgres required.
// Validators (end_date, same-year) and the overlap hook are application-level
// so they work identically in both SQLite and Postgres.

jest.mock('../config/database', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  return { sequelize, connectDB: async () => {} };
});

jest.mock('../cache',     () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() }));
jest.mock('../messenger', () => ({ sendToQueue: jest.fn() }));
jest.mock('../logger',    () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { sequelize } = require('../config/database');
const Employee          = require('../models/Employee');
const LeaveType         = require('../models/LeaveType');
const LeaveRequest      = require('../models/LeaveRequest');
const LeaveBalanceLedger = require('../models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('../models/LeaveRequestAudit');

// Re-apply associations (same as index.js — required because the mock swaps
// the sequelize instance before models are defined).
Employee.hasMany(LeaveRequest,        { foreignKey: 'employeeId',       as: 'leaveRequests'  });
LeaveRequest.belongsTo(Employee,      { foreignKey: 'employeeId',       as: 'employee'       });
LeaveType.hasMany(LeaveRequest,       { foreignKey: 'leaveTypeId',      as: 'requests'       });
LeaveRequest.belongsTo(LeaveType,     { foreignKey: 'leaveTypeId',      as: 'leaveType'      });
Employee.hasMany(LeaveBalanceLedger,  { foreignKey: 'employeeId',       as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(Employee,{ foreignKey: 'employeeId',       as: 'employee'       });
LeaveType.hasMany(LeaveBalanceLedger, { foreignKey: 'leaveTypeId',      as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(LeaveType,{ foreignKey: 'leaveTypeId',     as: 'leaveType'      });
LeaveRequest.hasMany(LeaveBalanceLedger,  { foreignKey: 'relatedRequestId', as: 'ledgerEntries' });
LeaveBalanceLedger.belongsTo(LeaveRequest,{ foreignKey: 'relatedRequestId', as: 'request'       });
LeaveRequest.hasMany(LeaveRequestAudit,  { foreignKey: 'requestId', as: 'auditEntries' });
LeaveRequestAudit.belongsTo(LeaveRequest,{ foreignKey: 'requestId', as: 'request'      });

let employee;
let leaveType;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  employee  = await Employee.create({ firstName: 'Test', lastName: 'User', email: 'test@leave.com' });
  leaveType = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
  // Clear only leave rows between tests; keep the employee + leaveType anchor rows.
  await LeaveRequestAudit.destroy({ where: {} });
  await LeaveBalanceLedger.destroy({ where: {} });
  await LeaveRequest.destroy({ where: {} });
});

// Helper to build a minimal valid LeaveRequest payload.
const req = (overrides = {}) => ({
  employeeId:      employee.id,
  leaveTypeId:     leaveType.id,
  startDate:       '2025-06-01',
  endDate:         '2025-06-05',
  workingDaysCount: 5,
  status:          'pending',
  ...overrides,
});

// ── Date validators ────────────────────────────────────────────────────────────

describe('LeaveRequest date constraints', () => {
  it('rejects end_date before start_date', async () => {
    await expect(
      LeaveRequest.create(req({ startDate: '2025-06-10', endDate: '2025-06-05' }))
    ).rejects.toThrow('end_date must be >= start_date');
  });

  it('accepts end_date equal to start_date (single-day leave)', async () => {
    const r = await LeaveRequest.create(req({ startDate: '2025-06-10', endDate: '2025-06-10', workingDaysCount: 1 }));
    expect(r.id).toBeDefined();
  });

  it('rejects a request that spans two calendar years', async () => {
    await expect(
      LeaveRequest.create(req({ startDate: '2025-12-30', endDate: '2026-01-03' }))
    ).rejects.toThrow('same calendar year');
  });

  it('accepts start_date and end_date in the same year', async () => {
    const r = await LeaveRequest.create(req({ startDate: '2025-01-02', endDate: '2025-01-10', workingDaysCount: 7 }));
    expect(r.id).toBeDefined();
  });
});

// ── Overlap constraints ────────────────────────────────────────────────────────

describe('LeaveRequest overlap constraints', () => {
  it('rejects a second pending request that overlaps an existing pending request', async () => {
    await LeaveRequest.create(req({ startDate: '2025-07-01', endDate: '2025-07-10', workingDaysCount: 8, status: 'pending' }));

    await expect(
      LeaveRequest.create(req({ startDate: '2025-07-05', endDate: '2025-07-15', workingDaysCount: 9, status: 'pending' }))
    ).rejects.toThrow('Overlapping active leave request');
  });

  it('rejects a pending request that overlaps an existing approved request', async () => {
    await LeaveRequest.create(req({ startDate: '2025-08-01', endDate: '2025-08-10', workingDaysCount: 8, status: 'approved' }));

    await expect(
      LeaveRequest.create(req({ startDate: '2025-08-05', endDate: '2025-08-15', workingDaysCount: 9, status: 'pending' }))
    ).rejects.toThrow('Overlapping active leave request');
  });

  it('rejects a second approved request that overlaps an existing approved request', async () => {
    await LeaveRequest.create(req({ startDate: '2025-09-01', endDate: '2025-09-10', workingDaysCount: 8, status: 'approved' }));

    await expect(
      LeaveRequest.create(req({ startDate: '2025-09-08', endDate: '2025-09-15', workingDaysCount: 6, status: 'approved' }))
    ).rejects.toThrow('Overlapping active leave request');
  });

  it('allows a new request that overlaps only a withdrawn request', async () => {
    await LeaveRequest.create(req({ startDate: '2025-10-01', endDate: '2025-10-10', workingDaysCount: 8, status: 'withdrawn' }));

    const r = await LeaveRequest.create(req({ startDate: '2025-10-05', endDate: '2025-10-15', workingDaysCount: 9, status: 'pending' }));
    expect(r.id).toBeDefined();
  });

  it('allows a new request that overlaps only a rejected request', async () => {
    await LeaveRequest.create(req({ startDate: '2025-11-01', endDate: '2025-11-10', workingDaysCount: 8, status: 'rejected' }));

    const r = await LeaveRequest.create(req({ startDate: '2025-11-05', endDate: '2025-11-15', workingDaysCount: 9, status: 'pending' }));
    expect(r.id).toBeDefined();
  });

  it('allows non-overlapping requests for the same employee', async () => {
    await LeaveRequest.create(req({ startDate: '2025-06-01', endDate: '2025-06-10', workingDaysCount: 8, status: 'approved' }));

    const r = await LeaveRequest.create(req({ startDate: '2025-06-11', endDate: '2025-06-15', workingDaysCount: 3, status: 'pending' }));
    expect(r.id).toBeDefined();
  });
});

// ── LeaveBalanceLedger constraints ─────────────────────────────────────────────

describe('LeaveBalanceLedger.days constraint', () => {
  it('rejects a ledger entry with days = 0', async () => {
    await expect(
      LeaveBalanceLedger.create({
        employeeId:      employee.id,
        leaveTypeId:     leaveType.id,
        entryType:       'accrual',
        days:            0,
        reason:          'test',
        effectiveDate:   '2025-01-01',
        createdByUserId: 'user-mongo-id',
      })
    ).rejects.toThrow('days must not be 0');
  });

  it('accepts a positive days value (credit)', async () => {
    const entry = await LeaveBalanceLedger.create({
      employeeId:      employee.id,
      leaveTypeId:     leaveType.id,
      entryType:       'accrual',
      days:            20.00,
      reason:          'Annual accrual',
      effectiveDate:   '2025-01-01',
      createdByUserId: 'user-mongo-id',
    });
    expect(entry.id).toBeDefined();
  });

  it('accepts a negative days value (debit)', async () => {
    const entry = await LeaveBalanceLedger.create({
      employeeId:      employee.id,
      leaveTypeId:     leaveType.id,
      entryType:       'consumption',
      days:            -5.00,
      reason:          'Leave taken',
      effectiveDate:   '2025-06-01',
      createdByUserId: 'user-mongo-id',
    });
    expect(parseFloat(entry.days)).toBe(-5);
  });
});

// ── Seed data shape ────────────────────────────────────────────────────────────

describe('LeaveType seed data', () => {
  it('can create annual leave type with correct shape', async () => {
    const lt = await LeaveType.findOne({ where: { code: 'annual' } });
    expect(lt.name).toBe('Annual Leave');
    expect(lt.isPaid).toBe(true);
    expect(lt.requiresProofAfterDays).toBeNull();
    expect(lt.maxRetroactiveDays).toBeNull();
  });

  it('can create sick leave type with proof and retroactive constraints', async () => {
    const sick = await LeaveType.create({
      code:                   'sick',
      name:                   'Sick Leave',
      isPaid:                 true,
      requiresProofAfterDays: 3,
      maxRetroactiveDays:     7,
    });
    expect(sick.requiresProofAfterDays).toBe(3);
    expect(sick.maxRetroactiveDays).toBe(7);
  });
});
