// AuthN / AuthZ tests for auth-service.
// Verifies that protected endpoints enforce JWT correctly:
//   - missing token → 401
//   - expired token → 401
//   - valid token but wrong role → 403

jest.mock('../../models/User');
jest.mock('../../models/RefreshToken');
jest.mock('../../models/AuditLog');

const express      = require('express');
const request      = require('supertest');
const jwt          = require('jsonwebtoken');
const User         = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const AuditLog     = require('../../models/AuditLog');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';

const makeToken = (overrides = {}, expiresIn = '1h') =>
  jwt.sign({ userId: 'uid1', username: 'tester', role: 'employee', ...overrides }, JWT_SECRET, { expiresIn });

const expiredToken = jwt.sign(
  { userId: 'uid1', username: 'tester', role: 'employee' },
  JWT_SECRET,
  { expiresIn: -1 }, // already expired
);

const app = express();
app.use(express.json());
app.use('/auth', require('../../routes/auth'));

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.create.mockResolvedValue({});
  RefreshToken.deleteMany = jest.fn().mockResolvedValue({});
  RefreshToken.deleteOne  = jest.fn().mockResolvedValue({});
});

// ── PUT /auth/change-password ─────────────────────────────────────────────────

describe('PUT /auth/change-password — AuthN enforcement', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).put('/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'newpass1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is expired', async () => {
    const res = await request(app).put('/auth/change-password')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ currentPassword: 'old', newPassword: 'newpass1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is malformed (not a valid JWT)', async () => {
    const res = await request(app).put('/auth/change-password')
      .set('Authorization', 'Bearer thisisnotajwt')
      .send({ currentPassword: 'old', newPassword: 'newpass1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header has wrong scheme (Basic instead of Bearer)', async () => {
    const res = await request(app).put('/auth/change-password')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .send({ currentPassword: 'old', newPassword: 'newpass1' });
    expect(res.status).toBe(401);
  });
});

// ── GET /auth/users — admin-only endpoint ─────────────────────────────────────

describe('GET /auth/users — role enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/auth/users');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const res = await request(app).get('/auth/users')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for employee role', async () => {
    const token = makeToken({ role: 'employee' });
    const res   = await request(app).get('/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for manager role', async () => {
    const token = makeToken({ role: 'manager' });
    const res   = await request(app).get('/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 for admin role', async () => {
    const token = makeToken({ role: 'admin' });
    User.find  = jest.fn().mockReturnValue({
      sort:  jest.fn().mockReturnThis(),
      skip:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });
    User.countDocuments = jest.fn().mockResolvedValue(0);
    const res = await request(app).get('/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── PUT /auth/users/:id/role — admin-only ─────────────────────────────────────

describe('PUT /auth/users/:id/role — role enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/auth/users/uid1/role')
      .send({ role: 'manager' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin (employee role)', async () => {
    const token = makeToken({ role: 'employee' });
    const res   = await request(app).put('/auth/users/uid1/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'manager' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-admin (manager role)', async () => {
    const token = makeToken({ role: 'manager' });
    const res   = await request(app).put('/auth/users/uid1/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'employee' });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /auth/users/:id — admin-only ──────────────────────────────────────

describe('DELETE /auth/users/:id — role enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/auth/users/uid1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for employee role', async () => {
    const token = makeToken({ role: 'employee' });
    const res   = await request(app).delete('/auth/users/uid1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /auth/audit-logs — admin-only ────────────────────────────────────────

describe('GET /auth/audit-logs — role enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/auth/audit-logs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for manager role', async () => {
    const token = makeToken({ role: 'manager' });
    const res   = await request(app).get('/auth/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
