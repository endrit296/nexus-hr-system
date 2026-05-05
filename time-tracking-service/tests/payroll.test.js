// Unit tests for time-tracking-service payroll and time-tracking endpoints.
// gRPC client and TimeLog model are mocked so no real connections are needed.

jest.mock('../src/grpc/employeeClient');
jest.mock('../src/models/TimeLog');
jest.mock('../src/registerService', () => ({ register: jest.fn(), startHeartbeat: jest.fn() }));

const express        = require('express');
const request        = require('supertest');
const employeeClient = require('../src/grpc/employeeClient');
const TimeLog        = require('../src/models/TimeLog');

const timeRoutes = require('../src/routes/time.routes');

const app = express();
app.use(express.json());

// Mirror the gateway-bypass guard from server.js
app.use('/api/payroll', (req, res, next) => {
  if (!req.headers['x-user-role']) {
    return res.status(401).json({ message: 'Unauthorized: direct access not permitted' });
  }
  next();
});
app.use('/api/payroll', timeRoutes);

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
  const validBody = { employeeName: 'Jane Doe', role: 'Engineer', hourlyRate: 25, hoursWorked: 160 };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).post('/api/payroll/calculate').send(validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 for employee role', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'employee')
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/insufficient permissions/i);
  });

  it('returns 200 with VERIFIED status for admin role', async () => {
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

  it('returns 200 with VERIFIED status for manager role', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'manager')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
  });

  it('calculates gross salary correctly (rate × hours)', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Test User', hourlyRate: 10, hoursWorked: 100 });
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.gross_total).toBe('1000.00 €');
  });

  it('deducts 10% tax from gross salary', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Test User', hourlyRate: 10, hoursWorked: 100 });
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.deductions).toBe('100.00 € (Tax 10%)');
    expect(res.body.financial_summary.final_net_salary).toBe('900.00 €');
  });

  it('defaults position to "Staff Member" when role is not provided', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
      .send({ employeeName: 'Test User', hourlyRate: 20, hoursWorked: 80 });
    expect(res.status).toBe(200);
    expect(res.body.employee_profile.position).toBe('Staff Member');
  });

  it('uses provided role as position', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('x-user-role', 'admin')
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
  const mockEmployee = { id: 1, firstName: 'Jane', lastName: 'Doe', position: 'Engineer' };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).get('/api/payroll/employee/1?hourlyRate=25');
    expect(res.status).toBe(401);
  });

  it('returns 403 for employee role', async () => {
    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=25')
      .set('x-user-role', 'employee');
    expect(res.status).toBe(403);
  });

  it('returns 200 with VERIFIED payroll using gRPC employee data', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=25&hoursWorked=160')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.employee_profile.full_name).toBe('Jane Doe');
    expect(res.body.employee_profile.employee_id).toBe(1);
  });

  it('uses default 160 hours when hoursWorked is not provided', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=10')
      .set('x-user-role', 'manager');
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
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.employee_profile.position).toBe('Staff Member');
  });

  it('calculates correct net salary (10% tax deducted)', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    const res = await request(app)
      .get('/api/payroll/employee/1?hourlyRate=10&hoursWorked=100')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.financial_summary.gross_total).toBe('1000.00 €');
    expect(res.body.financial_summary.final_net_salary).toBe('900.00 €');
  });
});

// ── POST /api/payroll/time/clock-in ──────────────────────────────────────────

describe('POST /api/payroll/time/clock-in', () => {
  const mockEmployee = { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@nexus.com' };

  const mockLog = {
    _id: 'log1',
    employeeId: 1,
    employeeNameSnapshot: 'Jane Doe',
    checkIn: new Date().toISOString(),
    status: 'Active',
  };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).post('/api/payroll/time/clock-in').send({ employeeId: 1 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when employeeId is missing', async () => {
    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'admin')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/employeeId/i);
  });

  it('returns 400 when employeeId is not a positive integer', async () => {
    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'admin')
      .send({ employeeId: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when employee not found via gRPC', async () => {
    employeeClient.getEmployee.mockRejectedValue(new Error('NOT_FOUND'));
    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'admin')
      .send({ employeeId: 99 });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns 201 on successful clock-in (admin clocking any employee)', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    TimeLog.findOne.mockResolvedValue(null);
    TimeLog.create.mockResolvedValue(mockLog);

    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'admin')
      .send({ employeeId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(1);
    expect(res.body.status).toBe('Active');
  });

  it('returns 201 when employee clocks in their own record', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    TimeLog.findOne.mockResolvedValue(null);
    TimeLog.create.mockResolvedValue(mockLog);

    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@nexus.com')
      .send({ employeeId: 1 });
    expect(res.status).toBe(201);
  });

  it('returns 403 when employee tries to clock in for another employee', async () => {
    employeeClient.getEmployee.mockResolvedValue({ ...mockEmployee, email: 'other@nexus.com' });

    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@nexus.com')
      .send({ employeeId: 1 });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/own time logs/i);
  });

  it('returns 409 when employee is already clocked in', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    TimeLog.findOne.mockResolvedValue(mockLog);

    const res = await request(app)
      .post('/api/payroll/time/clock-in')
      .set('x-user-role', 'admin')
      .send({ employeeId: 1 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already clocked in/i);
  });
});

// ── POST /api/payroll/time/clock-out ─────────────────────────────────────────

describe('POST /api/payroll/time/clock-out', () => {
  const mockEmployee = { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@nexus.com' };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).post('/api/payroll/time/clock-out').send({ employeeId: 1 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when employeeId is missing', async () => {
    const res = await request(app)
      .post('/api/payroll/time/clock-out')
      .set('x-user-role', 'admin')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when no active clock-in exists', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    TimeLog.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/payroll/time/clock-out')
      .set('x-user-role', 'admin')
      .send({ employeeId: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no active clock-in/i);
  });

  it('returns 200 and sets status to Completed on successful clock-out', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);

    const mockLog = {
      employeeId: 1,
      checkIn: new Date(Date.now() - 3600000), // 1 hour ago
      status: 'Active',
      save: jest.fn().mockResolvedValue(true),
    };
    TimeLog.findOne.mockResolvedValue(mockLog);

    const res = await request(app)
      .post('/api/payroll/time/clock-out')
      .set('x-user-role', 'admin')
      .send({ employeeId: 1 });
    expect(res.status).toBe(200);
    expect(mockLog.status).toBe('Completed');
    expect(mockLog.hoursWorked).toBeCloseTo(1, 1);
  });

  it('returns 403 when employee clocks out for another employee', async () => {
    employeeClient.getEmployee.mockResolvedValue({ ...mockEmployee, email: 'other@nexus.com' });

    const res = await request(app)
      .post('/api/payroll/time/clock-out')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@nexus.com')
      .send({ employeeId: 1 });
    expect(res.status).toBe(403);
  });
});

// ── GET /api/payroll/time/my ──────────────────────────────────────────────────

describe('GET /api/payroll/time/my', () => {
  const mockEmployee = { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@nexus.com' };

  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).get('/api/payroll/time/my?employeeId=1');
    expect(res.status).toBe(401);
  });

  it('returns 400 when employeeId query param is missing', async () => {
    const res = await request(app)
      .get('/api/payroll/time/my')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@nexus.com');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/employeeId/i);
  });

  it('returns 403 when employee queries another employee\'s logs', async () => {
    employeeClient.getEmployee.mockResolvedValue({ ...mockEmployee, email: 'other@nexus.com' });

    const res = await request(app)
      .get('/api/payroll/time/my?employeeId=1')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@nexus.com');
    expect(res.status).toBe(403);
  });

  it('returns 200 with timelogs and totalHours for own employee', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    const mockLogs = [
      { hoursWorked: 8, status: 'Completed', checkIn: new Date() },
      { hoursWorked: 7.5, status: 'Completed', checkIn: new Date() },
    ];
    TimeLog.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockLogs),
    });

    const res = await request(app)
      .get('/api/payroll/time/my?employeeId=1')
      .set('x-user-role', 'employee')
      .set('x-user-email', 'jane@nexus.com');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timelogs');
    expect(res.body).toHaveProperty('totalHours');
    expect(res.body.totalHours).toBeCloseTo(15.5, 1);
  });

  it('admin can query any employee\'s time logs', async () => {
    employeeClient.getEmployee.mockResolvedValue(mockEmployee);
    TimeLog.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    const res = await request(app)
      .get('/api/payroll/time/my?employeeId=1')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
  });
});

// ── GET /api/payroll/time/employee/:employeeId ────────────────────────────────

describe('GET /api/payroll/time/employee/:employeeId', () => {
  it('returns 401 when x-user-role header is missing', async () => {
    const res = await request(app).get('/api/payroll/time/employee/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for employee role', async () => {
    const res = await request(app)
      .get('/api/payroll/time/employee/1')
      .set('x-user-role', 'employee');
    expect(res.status).toBe(403);
  });

  it('returns 200 with timelogs and pagination for admin', async () => {
    const mockLogs = [{ employeeId: 1, hoursWorked: 8 }];
    TimeLog.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockLogs),
        }),
      }),
    });
    TimeLog.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/payroll/time/employee/1')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timelogs');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total', 1);
  });

  it('returns 200 for manager role', async () => {
    TimeLog.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    TimeLog.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/payroll/time/employee/1')
      .set('x-user-role', 'manager');
    expect(res.status).toBe(200);
  });
});
