// Authorization (AuthZ) tests for employee-service.
//
// Verifies:
//   1. Missing role header         → 401
//   2. Insufficient role           → 403
//   3. Employee accesses manager-only endpoint → 403
//   4. Manager accesses admin-only endpoint    → 403
//   5. Manager A cannot approve a leave request where employee's manager is manager B → 403
//   6. Data-scoping: manager can only edit their own direct reports → 403 otherwise

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

const employeeRoutes   = require('../../routes/employee');
const leaveRoutes      = require('../../routes/leave');
const departmentRoutes = require('../../routes/department');

const app = express();
app.use(express.json());
app.use('/employees',      employeeRoutes);
app.use('/leave-requests', leaveRoutes);
app.use('/departments',    departmentRoutes);

const nextYear = new Date().getFullYear() + 1;

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const futureMonday = (() => {
  const d = new Date(nextYear, 2, 1);
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

// ── 1. Missing role header → 401 ─────────────────────────────────────────────

describe('AuthZ: missing x-user-role header → 401', () => {
  it('POST /employees without role → 401', async () => {
    const res = await request(app).post('/employees')
      .send({ firstName: 'X', lastName: 'Y', email: 'authz1@test.com' });
    expect(res.status).toBe(401);
  });

  it('PUT /employees/:id without role → 401', async () => {
    const emp = await Employee.create({ firstName: 'A', lastName: 'B', email: 'authz2@test.com' });
    const res = await request(app).put(`/employees/${emp.id}`).send({ firstName: 'Z' });
    expect(res.status).toBe(401);
  });

  it('DELETE /employees/:id without role → 401', async () => {
    const emp = await Employee.create({ firstName: 'A', lastName: 'B', email: 'authz3@test.com' });
    const res = await request(app).delete(`/employees/${emp.id}`);
    expect(res.status).toBe(401);
  });

  it('POST /departments without role → 401', async () => {
    const res = await request(app).post('/departments').send({ name: 'AuthZDept' });
    expect(res.status).toBe(401);
  });

  it('DELETE /departments/:id without role → 401', async () => {
    const dept = await Department.create({ name: 'AuthZDept2' });
    const res  = await request(app).delete(`/departments/${dept.id}`);
    expect(res.status).toBe(401);
  });
});

// ── 2. Employee accesses manager/admin-only endpoints → 403 ──────────────────

describe('AuthZ: employee role accessing restricted endpoints → 403', () => {
  it('POST /employees as employee → 403', async () => {
    const res = await request(app).post('/employees')
      .set('x-user-role', 'employee')
      .send({ firstName: 'X', lastName: 'Y', email: 'authzrole1@test.com' });
    expect(res.status).toBe(403);
  });

  it('PUT /employees/:id as employee → 403', async () => {
    const emp = await Employee.create({ firstName: 'A', lastName: 'B', email: 'authzrole2@test.com' });
    const res = await request(app).put(`/employees/${emp.id}`)
      .set('x-user-role', 'employee')
      .send({ firstName: 'Z' });
    expect(res.status).toBe(403);
  });

  it('DELETE /employees/:id as employee → 403', async () => {
    const emp = await Employee.create({ firstName: 'A', lastName: 'B', email: 'authzrole3@test.com' });
    const res = await request(app).delete(`/employees/${emp.id}`)
      .set('x-user-role', 'employee');
    expect(res.status).toBe(403);
  });

  it('POST /departments as employee → 403', async () => {
    const res = await request(app).post('/departments')
      .set('x-user-role', 'employee')
      .send({ name: 'EmployeeDept' });
    expect(res.status).toBe(403);
  });
});

// ── 3. Manager accesses admin-only endpoints → 403 ───────────────────────────

describe('AuthZ: manager role accessing admin-only endpoints → 403', () => {
  it('POST /departments as manager → 403', async () => {
    const res = await request(app).post('/departments')
      .set('x-user-role', 'manager')
      .send({ name: 'ManagerDept' });
    expect(res.status).toBe(403);
  });

  it('DELETE /departments/:id as manager → 403', async () => {
    const dept = await Department.create({ name: 'ManagerDelDept' });
    const res  = await request(app).delete(`/departments/${dept.id}`)
      .set('x-user-role', 'manager');
    expect(res.status).toBe(403);
  });

  it('POST /employees as manager → 403', async () => {
    const res = await request(app).post('/employees')
      .set('x-user-role', 'manager')
      .send({ firstName: 'X', lastName: 'Y', email: 'mgr-emp@test.com' });
    expect(res.status).toBe(403);
  });

  it('DELETE /employees/:id as manager → 403', async () => {
    const emp = await Employee.create({ firstName: 'A', lastName: 'B', email: 'mgr-del@test.com' });
    const res = await request(app).delete(`/employees/${emp.id}`)
      .set('x-user-role', 'manager');
    expect(res.status).toBe(403);
  });
});

// ── 4. Leave approval data-scoping: manager A cannot approve employee of manager B

describe('AuthZ data-scoping: manager A cannot approve leave request of manager B employee', () => {
  it('returns 403 when manager A tries to approve a request belonging to manager B report', async () => {
    const managerA = await Employee.create({ firstName: 'ManagerA', lastName: 'A', email: 'mgra@test.com' });
    const managerB = await Employee.create({ firstName: 'ManagerB', lastName: 'B', email: 'mgrb@test.com' });
    const empB     = await Employee.create({ firstName: 'EmpB', lastName: 'B', email: 'empb@test.com', managerId: managerB.id });
    const annual   = await LeaveType.create({ code: 'annual', name: 'Annual', isPaid: true });
    await LeaveBalanceLedger.create({
      employeeId: empB.id, leaveTypeId: annual.id,
      entryType: 'accrual', days: 20, reason: 'grant',
      effectiveDate: `${nextYear}-01-01`, createdByUserId: 'test',
    });

    // empB submits a leave request
    const leaveRes = await request(app)
      .post('/leave-requests')
      .set({ 'x-user-email': empB.email, 'x-user-role': 'employee', 'x-user-id': 'test' })
      .send({ leaveTypeId: annual.id, startDate: futureMonday, endDate: futureMonday });

    expect(leaveRes.status).toBe(201);

    // Manager A tries to approve it (should fail — empB's manager is managerB)
    const approveRes = await request(app)
      .post(`/leave-requests/${leaveRes.body.id}/approve`)
      .set({ 'x-user-email': managerA.email, 'x-user-role': 'manager', 'x-user-id': 'test' })
      .send({});

    expect(approveRes.status).toBe(403);
  });
});

// ── 5. Manager data-scoping: cannot edit another manager's reports ─────────────

describe('AuthZ data-scoping: manager cannot edit employee belonging to another manager', () => {
  it('returns 403 when manager A tries to update employee of manager B', async () => {
    const managerA = await Employee.create({ firstName: 'MA2', lastName: 'A', email: 'ma2@test.com' });
    const managerB = await Employee.create({ firstName: 'MB2', lastName: 'B', email: 'mb2@test.com' });
    const empB     = await Employee.create({ firstName: 'Emp', lastName: 'B', email: 'empb2@test.com', managerId: managerB.id });

    const res = await request(app)
      .put(`/employees/${empB.id}`)
      .set({ 'x-user-role': 'manager', 'x-user-email': managerA.email })
      .send({ firstName: 'Hijacked' });

    expect(res.status).toBe(403);
  });
});

// ── 6. GET /leave-requests?all=true requires admin ────────────────────────────

describe('AuthZ: GET /leave-requests?all=true is admin-only', () => {
  it('returns 403 for employee role with all=true', async () => {
    const emp = await Employee.create({ firstName: 'E', lastName: 'F', email: 'alltest@test.com' });
    const res = await request(app)
      .get('/leave-requests?all=true')
      .set({ 'x-user-email': emp.email, 'x-user-role': 'employee' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for manager role with all=true', async () => {
    const mgr = await Employee.create({ firstName: 'M', lastName: 'G', email: 'alltest2@test.com' });
    const res = await request(app)
      .get('/leave-requests?all=true')
      .set({ 'x-user-email': mgr.email, 'x-user-role': 'manager' });
    expect(res.status).toBe(403);
  });
});
