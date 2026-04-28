// Use an in-memory SQLite database so tests run without a real PostgreSQL instance.
// jest.mock calls are hoisted before imports, so the mock is applied before any
// model file requires '../config/database'.

jest.mock('../config/database', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  return { sequelize, connectDB: async () => {} };
});

// Disable Redis — return cache misses so routes always hit the DB in tests.
jest.mock('../cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(null),
}));

// --- KJO ËSHTË PJESA E RE QË SHTOVA ---
// Disable RabbitMQ — Mocking messenger.js to prevent connection errors
jest.mock('../messenger', () => ({
  sendToQueue: jest.fn().mockResolvedValue(true),
}));
// --------------------------------------

const express    = require('express');
const request    = require('supertest');
const { sequelize } = require('../config/database');
const Employee   = require('../models/Employee');
const Department = require('../models/Department');

// Re-apply associations (normally in index.js, not in the route files)
Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',  onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',         onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',      onDelete: 'SET NULL', hooks: true });

const employeeRoutes   = require('../routes/employee');
const departmentRoutes = require('../routes/department');

const app = express();
app.use(express.json());
app.use('/employees', employeeRoutes);
app.use('/departments', departmentRoutes);

beforeAll(async () => {
  // SQLite doesn't support ENUM natively; Sequelize maps it to VARCHAR — works for tests.
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
  // Delete in FK-safe order
  await Employee.destroy({ where: {} });
  await Department.destroy({ where: {} });
});

// ── GET /employees ────────────────────────────────────────────────────────────

describe('GET /employees', () => {
  it('returns 200 with employees array for any authenticated role', async () => {
    const res = await request(app).get('/employees').set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('employees');
    expect(Array.isArray(res.body.employees)).toBe(true);
  });

  it('includes _links on each employee in the response', async () => {
    await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app).get('/employees').set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body.employees[0]).toHaveProperty('_links');
    expect(res.body.employees[0]._links).toHaveProperty('self');
  });

  it('returns an empty array when no employees exist', async () => {
    const res = await request(app).get('/employees').set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(0);
  });
});

// ── POST /employees ───────────────────────────────────────────────────────────

describe('POST /employees', () => {
  const validPayload = { firstName: 'Jane', lastName: 'Doe', email: 'jane@nexus.com' };

  it('returns 401 when no role header is provided', async () => {
    const res = await request(app).post('/employees').send(validPayload);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is employee (not admin)', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'employee')
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('returns 403 when role is manager', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'manager')
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('returns 201 with employee data and _links when admin creates employee', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('jane@nexus.com');
    expect(res.body).toHaveProperty('_links');
    expect(res.body._links.self).toHaveProperty('href');
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/employees').set('x-user-role', 'admin').send(validPayload);
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'John', lastName: 'Doe', email: 'jane@nexus.com' });
    expect(res.status).toBe(409);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane' }); // missing lastName and email
    expect(res.status).toBe(400);
  });
});

// ── GET /departments ──────────────────────────────────────────────────────────

describe('GET /departments', () => {
  it('returns 200 with departments array for any authenticated role', async () => {
    const res = await request(app).get('/departments').set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('departments');
    expect(Array.isArray(res.body.departments)).toBe(true);
  });

  it('includes _links and employeeCount on each department', async () => {
    await Department.create({ name: 'Engineering' });
    const res = await request(app).get('/departments').set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    const dept = res.body.departments[0];
    expect(dept).toHaveProperty('_links');
    expect(dept).toHaveProperty('employeeCount');
    expect(dept.name).toBe('Engineering');
  });
});

// ── POST /departments ─────────────────────────────────────────────────────────

describe('POST /departments', () => {
  it('returns 403 when role is not admin', async () => {
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'manager')
      .send({ name: 'HR' });
    expect(res.status).toBe(403);
  });

  it('returns 201 when admin creates a department', async () => {
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'admin')
      .send({ name: 'Engineering' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Engineering');
    expect(res.body).toHaveProperty('_links');
  });
});