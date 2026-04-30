// Unit tests for time-tracking-service payroll endpoints.
// gRPC client is mocked so no real employee-service connection is needed.

jest.mock('../src/grpc/employeeClient');
jest.mock('../src/registerService', () => ({ register: jest.fn(), startHeartbeat: jest.fn() }));

const express        = require('express');
const request        = require('supertest');
const employeeClient = require('../src/grpc/employeeClient');

const timeRoutes = require('../src/routes/time.routes');

const app = express();
app.use(express.json());

// Mirror the auth middleware from server.js
app.use('/api/payroll', (req, res, next) => {
  if (!req.headers['x-user-role']) {
    return res.status(401).json({ message: 'Unauthorized: direct access not permitted' });
  }
  next();
});
app.use('/api/payroll', timeRoutes);

// Health endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'time-tracking-service' }));

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET /health ───────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('time-tracking-service');
  });
});

// ── POST /api/payroll/calculate ───────────────────────────────────────────────

describe('POST /api/payroll/calculate', () => {
  const validBody = {
    employeeName: 'Jane Doe',
    role:         'Engineer',
    hourlyRate:   25,
    hoursWorked:  160,
  };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).post('/api/payroll/calculate').send(validBody);
    expect(res.status).toBe(401);
  });

  it('returns 200 with VERIFIED status on valid input', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body).toHaveProperty('financial_summary');
    expect(res.body).toHaveProperty('employee_profile');
    expect(res.body).toHaveProperty('header');
  });

  it('calculates gross salary correctly (rate × hours)', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'employee')
      .send({ employeeName: 'Test User', hourlyRate: 10, hoursWorked: 100 });
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.gross_total).toBe('1000.00 €');
  });

  it('deducts 10% tax from gross salary', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'employee')
      .send({ employeeName: 'Test User', hourlyRate: 10, hoursWorked: 100 });
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.deductions).toBe('100.00 € (Tax 10%)');
    expect(res.body.financial_summary.final_net_salary).toBe('900.00 €');
  });

  it('defaults position to "Staff Member" when role is not provided', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'employee')
      .send({ employeeName: 'Test User', hourlyRate: 20, hoursWorked: 80 });
    expect(res.status).toBe(200);
    expect(res.body.employee_profile.position).toBe('Staff Member');
  });

  it('uses provided role as position', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'employee')
      .send({ employeeName: 'Test User', role: 'Senior Dev', hourlyRate: 30, hoursWorked: 80 });
    expect(res.status).toBe(200);
    expect(res.body.employee_profile.position).toBe('Senior Dev');
  });

  it('returns 400 when employeeName is missing', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ hourlyRate: 25, hoursWorked: 160 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/employeeName/i);
  });

  it('returns 400 when employeeName is an empty string', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: '   ', hourlyRate: 25, hoursWorked: 160 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when hourlyRate is zero', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Jane', hourlyRate: 0, hoursWorked: 160 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hourlyRate/i);
  });

  it('returns 400 when hourlyRate is negative', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Jane', hourlyRate: -10, hoursWorked: 160 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when hoursWorked is zero', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Jane', hourlyRate: 25, hoursWorked: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hoursWorked/i);
  });

  it('returns 400 when hourlyRate is not a number', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Jane', hourlyRate: 'abc', hoursWorked: 160 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when hoursWorked is not a number', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Jane', hourlyRate: 25, hoursWorked: 'abc' });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/payroll/employee/:id ─────────────────────────────────────────────

describe('GET /api/payroll/employee/:id', () => {
  const mockEmployee = {
    id: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    position: 'Engineer',
  };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).get('/api/payroll/employee/1?hourlyRate=25');
    expect(res.status).toBe(401);
  });

  it('returns 200 with VERIFIED payroll using gRPC employee data', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);

    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=25&hoursWorked=160')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.employee_profile.full_name).toBe('Jane Doe');
    expect(res.body.employee_profile.position).toBe('Engineer');
    expect(res.body.employee_profile.employee_id).toBe(1);
  });

  it('uses default 160 hours when hoursWorked is not provided', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);

    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=10')
      .set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.gross_total).toBe('1600.00 €');
  });

  it('returns 404 when employee is not found via gRPC', async () => {
    employeeClient.getEmployee.mockRejectedValue(new Error('NOT_FOUND'));

    const res = await request(app)
      .get('/api/payroll/employee/9999?hourlyRate=25')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns 400 when hourlyRate is missing or zero', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);

    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=0')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(400);
  });

  it('defaults position to "Staff Member" when employee has no position', async () => {
    employeeClient.getEmployee.mockResolvedValue({ ...mockEmployee, position: '' });

    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=20')
      .set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body.employee_profile.position).toBe('Staff Member');
  });

  it('calculates correct net salary (10% tax deducted)', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);

    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=10&hoursWorked=100')
      .set('x-user-role', 'employee');
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.gross_total).toBe('1000.00 €');
    expect(res.body.financial_summary.final_net_salary).toBe('900.00 €');
  });
});
