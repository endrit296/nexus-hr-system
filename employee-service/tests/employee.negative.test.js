// Negative input tests for employee and department endpoints.
// Covers malformed JSON, wrong types, missing required fields, invalid email formats,
// invalid status values, and non-existent IDs.

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

// ── POST /employees — missing required fields ─────────────────────────────────

describe('POST /employees — missing required fields', () => {
  it('returns 400 when firstName is missing', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ lastName: 'Doe', email: 'missingfirst@test.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when lastName is missing', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', email: 'missinglast@test.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when all required fields are missing', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── POST /employees — invalid email format ─────────────────────────────────────

describe('POST /employees — invalid email format', () => {
  it('returns 400 for email without @ symbol', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'notanemail' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns 400 for email without domain', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane@' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for email with consecutive dots', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane..doe@test.com' });
    expect(res.status).toBe(400);
  });
});

// ── POST /employees — wrong field types ───────────────────────────────────────

describe('POST /employees — wrong field types', () => {
  it('returns 400 when salary is a string', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j@test.com', salary: 'fifty thousand' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when salary is negative', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j2@test.com', salary: -1000 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when hourlyRate is negative', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j3@test.com', hourlyRate: -5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when departmentId is a string', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j4@test.com', departmentId: 'engineering' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when status is an invalid value', async () => {
    const res = await request(app)
      .post('/employees')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j5@test.com', status: 'retired' });
    expect(res.status).toBe(400);
  });
});

// ── POST /employees — malformed JSON ─────────────────────────────────────────

describe('POST /employees — malformed JSON', () => {
  it('returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/employees')
      .set({ 'x-user-role': 'admin', 'Content-Type': 'application/json' })
      .send('{ not valid json at all }');
    expect(res.status).toBe(400);
  });
});

// ── PUT /employees/:id — negative inputs ─────────────────────────────────────

describe('PUT /employees/:id — negative inputs', () => {
  it('returns 400 when email format is invalid on update', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@put.com' });
    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'admin')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when salary is negative on update', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'janep2@put.com' });
    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'admin')
      .send({ salary: -500 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when employee ID does not exist', async () => {
    const res = await request(app)
      .put('/employees/99999')
      .set('x-user-role', 'admin')
      .send({ firstName: 'New' });
    expect(res.status).toBe(404);
  });
});

// ── POST /departments — negative inputs ───────────────────────────────────────

describe('POST /departments — negative inputs', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'admin')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is an empty string', async () => {
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'admin')
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is whitespace only', async () => {
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'admin')
      .send({ name: '   ' });
    // Joi's .trim() turns whitespace-only into empty string → fails required()
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/departments')
      .set({ 'x-user-role': 'admin', 'Content-Type': 'application/json' })
      .send('{ bad json }');
    expect(res.status).toBe(400);
  });
});
