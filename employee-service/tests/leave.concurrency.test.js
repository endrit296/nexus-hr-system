// Concurrency test for the leave-request overlap constraint.
//
// SKIPPED — describes a race condition that is NOT prevented by the current
// application-layer beforeCreate hook under concurrent requests.
// Un-skip only after wrapping createRequest in a SERIALIZABLE transaction
// with SELECT ... FOR UPDATE, or after adding a btree_gist exclusion constraint.
//
// See investigation notes at the bottom of this file for the full analysis.

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

// Mirror the associations from index.js
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

const app = express();
app.use(express.json());
app.use('/employees',      employeeRoutes);
app.use('/leave-requests', leaveRoutes);

// ── Helpers (same pattern as leave.routes.test.js) ────────────────────────────

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findMonFri(year) {
  const d = new Date(year, 5, 1); // June 1 of given year (local time)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // advance to Monday
  const mon = isoLocal(d);
  d.setDate(d.getDate() + 4);
  return [mon, isoLocal(d)]; // [Monday, Friday] — always exactly 5 working days
}

const nextYear = new Date().getFullYear() + 1;
const [futureStart, futureEnd] = findMonFri(nextYear);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

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

// ── Skipped concurrency test ──────────────────────────────────────────────────

describe.skip('Concurrent overlapping leave requests — overlap constraint race', () => {
  it('only one of two simultaneous overlapping requests should succeed (201); the other must be rejected (409 or 400)', async () => {
    // Arrange: employee with a manager and 20 days of annual leave balance
    const manager = await Employee.create({ firstName: 'Boss', lastName: 'Man', email: 'boss@test.com' });
    const emp = await Employee.create({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com',
      managerId: manager.id, hireDate: '2020-01-01',
    });
    const annual = await LeaveType.create({ code: 'annual', name: 'Annual Leave', isPaid: true });

    await LeaveBalanceLedger.create({
      employeeId:      emp.id,
      leaveTypeId:     annual.id,
      entryType:       'accrual',
      days:            20,
      reason:          'Annual grant',
      effectiveDate:   '2025-01-01',
      createdByUserId: 'test',
    });

    const payload = { leaveTypeId: annual.id, startDate: futureStart, endDate: futureEnd };
    const hdrs    = { 'x-user-email': emp.email, 'x-user-role': 'employee', 'x-user-id': 'user-1' };

    // Act: fire two identical overlapping requests simultaneously
    const [res1, res2] = await Promise.all([
      request(app).post('/leave-requests').set(hdrs).send(payload),
      request(app).post('/leave-requests').set(hdrs).send(payload),
    ]);

    const statuses = [res1.status, res2.status];

    // Assert: exactly one 201, the other a conflict (409) or validation error (400)
    const successCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409 || s === 400).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // The conflicting response must carry an overlap-related message
    const conflictBody = res1.status === 201 ? res2.body : res1.body;
    expect(conflictBody.message).toMatch(/overlap|already.*active|covering these dates/i);

    // Database must contain exactly one leave request row
    const rows = await LeaveRequest.findAll({ where: { employeeId: emp.id } });
    expect(rows).toHaveLength(1);
  });
});

/*
 * ── Investigation notes ───────────────────────────────────────────────────────
 *
 * Q1 — Does LeaveRequest have an exclusion constraint or unique index on dates?
 *
 *   No. models/LeaveRequest.js defines:
 *   - No `indexes` array in the sequelize.define options object.
 *   - No raw SQL exclusion constraint.
 *   - A comment at line 82-83 explicitly acknowledges that btree_gist is not used:
 *       "Implemented as a beforeCreate hook because Postgres range exclusion
 *        constraints require the btree_gist extension which is not guaranteed
 *        in this environment."
 *
 *   The only overlap protection is a beforeCreate hook (lines 84-100):
 *     LeaveRequest.addHook('beforeCreate', async (req) => {
 *       const conflict = await LeaveRequest.findOne({ where: {
 *         employeeId: req.employeeId,
 *         status: { [Op.in]: ['pending','approved'] },
 *         startDate: { [Op.lte]: req.endDate },
 *         endDate:   { [Op.gte]: req.startDate },
 *       }});
 *       if (conflict) throw new Error('Overlapping active leave request exists…');
 *     });
 *
 * Q2 — Does the POST handler or service method use a transaction or locking?
 *
 *   No. The call chain is:
 *     POST /leave-requests (leave.js:26-34)
 *       → leaveService.createRequest(...)   (LeaveService.js:66-133)
 *         → leaveRepo.createRequest(data)   (LeaveRepository.js:27-29)
 *           → LeaveRequest.create(data)     (Sequelize)
 *
 *   LeaveService.createRequest has no sequelize.transaction() call.
 *   LeaveRepository.createRequest is a bare LeaveRequest.create(data) — no
 *   transaction object passed, no isolation level specified.
 *   The beforeCreate hook's findOne runs in its own autocommit transaction at
 *   the default isolation level (READ COMMITTED in Postgres).
 *
 *   The gap: both concurrent requests can execute their findOne at the same
 *   instant, both see zero conflicts, both proceed to INSERT. No
 *   SELECT ... FOR UPDATE, no advisory lock, no serializable transaction
 *   wraps the read + write pair.
 *
 * Prediction if this test were un-skipped:
 *
 *   Against PostgreSQL (production): WOULD FAIL.
 *   Under READ COMMITTED isolation, Transaction A's findOne and Transaction B's
 *   findOne both execute before either INSERT is committed. Both see no overlap.
 *   Both INSERTs succeed. The test's assertion "exactly one 201" fails — it
 *   gets two 201s and two DB rows instead of one.
 *
 *   Against SQLite in-memory (this test environment): PASSES INCIDENTALLY.
 *   SQLite serialises all writers. One of the two Promise.all branches will
 *   physically execute its findOne→INSERT pair before the other even begins,
 *   making the race deterministically safe. The test will pass, but only as an
 *   artifact of SQLite's serialised writer model — not because the application
 *   code is correct.
 *
 *   The test is skipped rather than run for this reason: a green result here
 *   would give false confidence about production behaviour.
 */
