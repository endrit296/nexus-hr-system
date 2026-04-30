// Use an in-memory SQLite database so tests run without a real PostgreSQL instance.
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

jest.mock('../messenger', () => ({
  sendToQueue: jest.fn().mockResolvedValue(true),
}));

const express    = require('express');
const request    = require('supertest');
const { sequelize } = require('../config/database');
const Employee   = require('../models/Employee');
const Department = require('../models/Department');

// Re-apply associations
Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',   onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',         onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',      onDelete: 'SET NULL', hooks: true });

const employeeRoutes   = require('../routes/employee');
const departmentRoutes = require('../routes/department');

const app = express();
app.use(express.json());
app.use('/employees',  employeeRoutes);
app.use('/departments', departmentRoutes);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
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

  it('returns pagination metadata', async () => {
    await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app).get('/employees?page=1&limit=10').set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('totalPages');
  });

  it('filters employees by status', async () => {
    await Employee.create({ firstName: 'Active', lastName: 'User', email: 'active@test.com', status: 'active' });
    await Employee.create({ firstName: 'Inactive', lastName: 'User', email: 'inactive@test.com', status: 'inactive' });

    const res = await request(app).get('/employees?status=inactive').set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].email).toBe('inactive@test.com');
  });

  it('filters employees by departmentId', async () => {
    const dept = await Department.create({ name: 'Engineering' });
    await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', departmentId: dept.id });
    await Employee.create({ firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com' });

    const res = await request(app).get(`/employees?departmentId=${dept.id}`).set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].email).toBe('jane@test.com');
  });

  it('searches employees by name', async () => {
    await Employee.create({ firstName: 'Alice', lastName: 'Johnson', email: 'alice@test.com' });
    await Employee.create({ firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com' });

    const res = await request(app).get('/employees?search=alice').set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
  });
});

// ── GET /employees/:id ────────────────────────────────────────────────────────

describe('GET /employees/:id', () => {
  it('returns 200 with employee data and _links', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });

    const res = await request(app).get(`/employees/${emp.id}`).set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('jane@test.com');
    expect(res.body).toHaveProperty('_links');
  });

  it('returns 404 when employee does not exist', async () => {
    const res = await request(app).get('/employees/99999').set('x-user-role', 'employee');
    expect(res.status).toBe(404);
  });
});

// ── GET /employees/me ─────────────────────────────────────────────────────────

describe('GET /employees/me', () => {
  it('returns 401 when x-user-email header is missing', async () => {
    const res = await request(app).get('/employees/me').set('x-user-role', 'employee');
    expect(res.status).toBe(401);
  });

  it('returns employee profile matching the user email', async () => {
    await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });

    const res = await request(app)
      .get('/employees/me')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@test.com');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('jane@test.com');
  });

  it('returns 404 when no employee record matches the email', async () => {
    const res = await request(app)
      .get('/employees/me')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'nobody@test.com');
    expect(res.status).toBe(404);
  });
});

// ── POST /employees ───────────────────────────────────────────────────────────

describe('POST /employees', () => {
  const validPayload = { firstName: 'Jane', lastName: 'Doe', email: 'jane@nexus.com' };

  it('returns 401 when no role header is provided', async () => {
    const res = await request(app).post('/employees').send(validPayload);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is employee', async () => {
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
      .send({ firstName: 'Jane' });
    expect(res.status).toBe(400);
  });

  it('sends a RabbitMQ message after successful creation', async () => {
    const { sendToQueue } = require('../messenger');
    await request(app).post('/employees').set('x-user-role', 'admin').send(validPayload);
    expect(sendToQueue).toHaveBeenCalledWith('employee_events', expect.objectContaining({ event: 'CREATED' }));
  });
});

// ── PUT /employees/:id ────────────────────────────────────────────────────────

describe('PUT /employees/:id', () => {
  it('returns 401 when no role header provided', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app).put(`/employees/${emp.id}`).send({ firstName: 'Janet' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is employee', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'employee')
      .send({ firstName: 'Janet' });
    expect(res.status).toBe(403);
  });

  it('returns 200 when admin updates employee', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'admin')
      .send({ firstName: 'Janet' });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Janet');
  });

  it('returns 404 when employee to update does not exist', async () => {
    const res = await request(app)
      .put('/employees/99999')
      .set('x-user-role', 'admin')
      .send({ firstName: 'Janet' });
    expect(res.status).toBe(404);
  });

  it('returns 409 on duplicate email during update', async () => {
    await Employee.create({ firstName: 'Alice', lastName: 'A', email: 'alice@test.com' });
    const emp = await Employee.create({ firstName: 'Bob', lastName: 'B', email: 'bob@test.com' });
    const res = await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'admin')
      .send({ email: 'alice@test.com' });
    expect(res.status).toBe(409);
  });

  it('sends a RabbitMQ message after successful update', async () => {
    const { sendToQueue } = require('../messenger');
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    await request(app)
      .put(`/employees/${emp.id}`)
      .set('x-user-role', 'admin')
      .send({ firstName: 'Janet' });
    expect(sendToQueue).toHaveBeenCalledWith('employee_events', expect.objectContaining({ event: 'UPDATED' }));
  });
});

// ── DELETE /employees/:id ─────────────────────────────────────────────────────

describe('DELETE /employees/:id', () => {
  it('returns 401 when no role header provided', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app).delete(`/employees/${emp.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is not admin', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app)
      .delete(`/employees/${emp.id}`)
      .set('x-user-role', 'manager');
    expect(res.status).toBe(403);
  });

  it('returns 200 when admin deletes employee', async () => {
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    const res = await request(app)
      .delete(`/employees/${emp.id}`)
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
  });

  it('returns 404 when employee does not exist', async () => {
    const res = await request(app)
      .delete('/employees/99999')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(404);
  });

  it('sends a RabbitMQ message after successful deletion', async () => {
    const { sendToQueue } = require('../messenger');
    const emp = await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    await request(app).delete(`/employees/${emp.id}`).set('x-user-role', 'admin');
    expect(sendToQueue).toHaveBeenCalledWith('employee_events', expect.objectContaining({ event: 'DELETED' }));
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

  it('returns pagination metadata', async () => {
    const res = await request(app).get('/departments?page=1&limit=10').set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total');
  });

  it('searches departments by name', async () => {
    await Department.create({ name: 'Engineering' });
    await Department.create({ name: 'Marketing' });

    const res = await request(app).get('/departments?search=eng').set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(1);
    expect(res.body.departments[0].name).toBe('Engineering');
  });
});

// ── GET /departments/:id ──────────────────────────────────────────────────────

describe('GET /departments/:id', () => {
  it('returns 200 with department data and _links', async () => {
    const dept = await Department.create({ name: 'Engineering' });
    const res = await request(app).get(`/departments/${dept.id}`).set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Engineering');
    expect(res.body).toHaveProperty('_links');
  });

  it('returns 404 when department does not exist', async () => {
    const res = await request(app).get('/departments/99999').set('x-user-role', 'employee');
    expect(res.status).toBe(404);
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

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'admin')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate department name', async () => {
    await request(app).post('/departments').set('x-user-role', 'admin').send({ name: 'Engineering' });
    const res = await request(app)
      .post('/departments')
      .set('x-user-role', 'admin')
      .send({ name: 'Engineering' });
    expect(res.status).toBe(409);
  });
});

// ── DELETE /departments/:id ───────────────────────────────────────────────────

describe('DELETE /departments/:id', () => {
  it('returns 401 when no role header provided', async () => {
    const dept = await Department.create({ name: 'Engineering' });
    const res = await request(app).delete(`/departments/${dept.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is not admin', async () => {
    const dept = await Department.create({ name: 'Engineering' });
    const res = await request(app)
      .delete(`/departments/${dept.id}`)
      .set('x-user-role', 'manager');
    expect(res.status).toBe(403);
  });

  it('returns 200 when admin deletes an empty department', async () => {
    const dept = await Department.create({ name: 'Engineering' });
    const res = await request(app)
      .delete(`/departments/${dept.id}`)
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
  });

  it('returns 404 when department does not exist', async () => {
    const res = await request(app)
      .delete('/departments/99999')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(404);
  });

  it('returns 400 when department has employees (cannot delete)', async () => {
    const dept = await Department.create({ name: 'Engineering' });
    await Employee.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', departmentId: dept.id });

    const res = await request(app)
      .delete(`/departments/${dept.id}`)
      .set('x-user-role', 'admin');
    expect(res.status).toBe(400);
  });
});
