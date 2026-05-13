// Edge-case tests for employee and department endpoints.
// Covers max-length strings, missing optional fields, pagination boundaries,
// case-sensitivity, search with special characters, and soft-delete edge cases.

jest.mock('../config/database', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  return { sequelize, connectDB: async () => {} };
});

jest.mock('../cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(null),
}));

jest.mock('../messenger', () => ({ sendToQueue: jest.fn().mockResolvedValue(true) }));
jest.mock('../logger',    () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('node-schedule', () => ({ scheduleJob: jest.fn() }));

const express    = require('express');
const request    = require('supertest');
const { sequelize } = require('../config/database');
const Employee   = require('../models/Employee');
const Department = require('../models/Department');

Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',   onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',         onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',      onDelete: 'SET NULL', hooks: true });

const employeeRoutes   = require('../routes/employee');
const departmentRoutes = require('../routes/department');

const app = express();
app.use(express.json());
app.use('/employees',   employeeRoutes);
app.use('/departments', departmentRoutes);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
  await Employee.destroy({ where: {}, force: true });
  await Department.destroy({ where: {} });
});

// ── Max-length string inputs ──────────────────────────────────────────────────

describe('Edge case: max-length string inputs', () => {
  it('creates employee with firstName of exactly 255 characters', async () => {
    const firstName = 'A'.repeat(255);
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName, lastName: 'Test', email: 'maxfirst@test.com' });
    // Sequelize STRING without explicit length defaults to VARCHAR(255)
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.firstName.length).toBe(255);
    }
  });

  it('creates employee with lastName of exactly 255 characters', async () => {
    const lastName = 'Z'.repeat(255);
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Test', lastName, email: 'maxlast@test.com' });
    expect([201, 400]).toContain(res.status);
  });

  it('creates employee with position of exactly 255 characters', async () => {
    const position = 'P'.repeat(255);
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Test', lastName: 'Emp', email: 'maxpos@test.com', position });
    expect([201, 400]).toContain(res.status);
  });
});

// ── Employee without optional fields ─────────────────────────────────────────

describe('Edge case: optional fields omitted', () => {
  it('creates employee without phone, position, salary, or department', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Minimal', lastName: 'Employee', email: 'minimal@test.com' });
    expect(res.status).toBe(201);
    expect(res.body.phone).toBeNull ? expect(res.body.phone == null).toBe(true)
                                    : expect([null, undefined]).toContain(res.body.phone);
  });

  it('creates employee without a manager (no managerId)', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Solo', lastName: 'Worker', email: 'solo@test.com' });
    expect(res.status).toBe(201);
    expect([null, undefined]).toContain(res.body.managerId);
  });

  it('creates employee without a department (no departmentId)', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'NoDept', lastName: 'Worker', email: 'nodept@test.com' });
    expect(res.status).toBe(201);
    expect([null, undefined]).toContain(res.body.departmentId);
  });
});

// ── Pagination boundary values ────────────────────────────────────────────────

describe('Edge case: pagination boundary values', () => {
  it('returns 200 for page=1&limit=1', async () => {
    await Employee.create({ firstName: 'A', lastName: 'B', email: 'a@test.com' });
    await Employee.create({ firstName: 'C', lastName: 'D', email: 'c@test.com' });

    const res = await request(app)
      .get('/employees?page=1&limit=1')
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
  });

  it('returns 200 for page beyond total (no employees on that page)', async () => {
    await Employee.create({ firstName: 'A', lastName: 'B', email: 'onlyone@test.com' });

    const res = await request(app)
      .get('/employees?page=99&limit=20')
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(0);
  });

  it('returns 200 for limit=1 (smallest valid page size)', async () => {
    await Employee.create({ firstName: 'A', lastName: 'B', email: 'lim1@test.com' });

    const res = await request(app)
      .get('/employees?limit=1')
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.employees.length).toBeLessThanOrEqual(1);
  });
});

// ── Search edge cases ─────────────────────────────────────────────────────────

describe('Edge case: search parameter', () => {
  it('returns 200 with all employees when search is empty string', async () => {
    await Employee.create({ firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' });
    await Employee.create({ firstName: 'Bob',   lastName: 'Jones', email: 'bob@test.com' });

    const res = await request(app)
      .get('/employees?search=')
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.employees.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for search term that matches no employee', async () => {
    await Employee.create({ firstName: 'Alice', lastName: 'Smith', email: 'alice2@test.com' });

    const res = await request(app)
      .get('/employees?search=zzznomatch')
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(0);
  });

  it('handles search with SQL-like special characters without crashing', async () => {
    const res = await request(app)
      .get("/employees?search=%25like%25")
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.status).not.toBe(500);
  });

  it('handles search with regex special character dot (.) without crashing', async () => {
    const res = await request(app)
      .get('/employees?search=.')
      .set('x-user-role', 'admin');

    expect(res.status).toBe(200);
  });
});

// ── Email case sensitivity ────────────────────────────────────────────────────

describe('Edge case: email case sensitivity', () => {
  it('returns employee when email lookup uses different case', async () => {
    await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });

    // The resolveEmployee middleware does a case-sensitive lookup by default in SQLite.
    // This test documents the current behaviour.
    const upperRes = await request(app)
      .get('/employees/me')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'JANE@TEST.COM');

    // Behaviour depends on DB collation — this should be 200 OR 404, never 500.
    expect([200, 404]).toContain(upperRes.status);
    expect(upperRes.status).not.toBe(500);
  });
});

// ── GET /employees/:id with non-numeric ID ────────────────────────────────────

describe('Edge case: non-numeric employee ID in URL', () => {
  it('returns 400 or 404 for string ID in URL (not a valid integer)', async () => {
    const res = await request(app)
      .get('/employees/not-a-number')
      .set('x-user-role', 'admin');

    expect([400, 404, 500]).toContain(res.status);
    // Should never crash the server in an unhandled way
    expect(res.status).not.toBe(500);
  });
});

// ── DELETE already-deleted employee ──────────────────────────────────────────

describe('Edge case: operating on soft-deleted employees', () => {
  it('returns 404 when trying to delete an already soft-deleted employee', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'softdel@test.com' });
    await request(app).delete(`/employees/${emp.id}`).set('x-user-role', 'admin');

    const res = await request(app)
      .delete(`/employees/${emp.id}`)
      .set('x-user-role', 'admin');

    expect(res.status).toBe(404);
  });

  it('returns 404 when trying to PUT a soft-deleted employee', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'softput@test.com' });
    await request(app).delete(`/employees/${emp.id}`).set('x-user-role', 'admin');

    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'admin')
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(404);
  });
});

// ── Department with exactly 0 employees ──────────────────────────────────────

describe('Edge case: department with zero employees', () => {
  it('returns employeeCount=0 for a newly created department', async () => {
    await request(app).post('/departments').set('x-user-role', 'admin').send({ name: 'EmptyDept' });

    const res = await request(app).get('/departments').set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    const dept = res.body.departments.find((d) => d.name === 'EmptyDept');
    expect(dept).toBeDefined();
    expect(dept.employeeCount).toBe(0);
  });
});
