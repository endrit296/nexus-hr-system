// Integration tests for auth-service routes.
// Models are mocked so no real DB or SMTP is required.

jest.mock('../models/User');
jest.mock('../models/RefreshToken');
jest.mock('../models/AuditLog');

const express      = require('express');
const request      = require('supertest');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog     = require('../models/AuditLog');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';

const makeToken = (overrides = {}) =>
  jwt.sign({ userId: 'uid1', username: 'testuser', role: 'employee', ...overrides }, JWT_SECRET, { expiresIn: '1h' });

const mockChain = (result) => ({
  sort:  jest.fn().mockReturnThis(),
  skip:  jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(result),
});

const app = express();
app.use(express.json());
app.use('/auth', require('../routes/auth'));

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.create.mockResolvedValue({});
  RefreshToken.deleteMany = jest.fn().mockResolvedValue({});
  RefreshToken.deleteOne  = jest.fn().mockResolvedValue({});
});

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  const body = { username: 'testuser', email: 'test@nexus.com', password: 'secret123' };

  it('returns 201 with a message (no tokens — email verification required)', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'uid1', username: 'testuser', email: 'test@nexus.com', role: 'employee' });

    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns 409 when email or username is already registered', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing' });

    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(409);
    expect(User.create).not.toHaveBeenCalled();
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is shorter than 6 characters', async () => {
    const res = await request(app).post('/auth/register').send({ ...body, password: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app).post('/auth/register').send({ ...body, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when username is too short (< 3 chars)', async () => {
    const res = await request(app).post('/auth/register').send({ ...body, username: 'ab' });
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  const hashed = bcrypt.hashSync('secret123', 10);
  const mockUser = { _id: 'uid1', username: 'testuser', email: 'test@nexus.com', role: 'employee', password: hashed, isVerified: true };

  it('returns 200 with tokens on correct credentials', async () => {
    User.findOne.mockResolvedValue(mockUser);
    RefreshToken.create.mockResolvedValue({});

    const res = await request(app).post('/auth/login').send({ email: 'test@nexus.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');

    const decoded = jwt.decode(res.body.token);
    expect(decoded.username).toBe('testuser');
    expect(decoded.role).toBe('employee');
  });

  it('returns 401 when email is not found', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/auth/login').send({ email: 'no@one.com', password: 'secret123' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on wrong password', async () => {
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app).post('/auth/login').send({ email: 'test@nexus.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when account is not yet verified', async () => {
    User.findOne.mockResolvedValue({ ...mockUser, isVerified: false });
    RefreshToken.create.mockResolvedValue({});

    const res = await request(app).post('/auth/login').send({ email: 'test@nexus.com', password: 'secret123' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify/i);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('allows login for legacy user without isVerified field (undefined)', async () => {
    const { isVerified: _, ...legacyUser } = mockUser;
    User.findOne.mockResolvedValue({ ...legacyUser, isVerified: undefined });
    RefreshToken.create.mockResolvedValue({});

    const res = await request(app).post('/auth/login').send({ email: 'test@nexus.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  const mockUser = { _id: 'uid1', username: 'testuser', email: 'test@nexus.com', role: 'employee' };

  it('returns 200 with a new access token on a valid refresh token', async () => {
    RefreshToken.findOne.mockResolvedValue({ token: 'validtoken', userId: 'uid1', expiresAt: new Date(Date.now() + 1e6) });
    User.findById.mockResolvedValue(mockUser);

    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'validtoken' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 403 when refresh token does not exist in DB', async () => {
    RefreshToken.findOne.mockResolvedValue(null);

    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'badtoken' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when refresh token is expired', async () => {
    RefreshToken.findOne.mockResolvedValue({ token: 'expiredtoken', userId: 'uid1', expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'expiredtoken' });
    expect(res.status).toBe(403);
  });

  it('returns 401 when no refresh token is provided', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('returns 200 even when no refresh token is sent', async () => {
    const res = await request(app).post('/auth/logout').send({});
    expect(res.status).toBe(200);
  });

  it('returns 200 and deletes the provided refresh token', async () => {
    const res = await request(app).post('/auth/logout').send({ refreshToken: 'mytoken' });
    expect(res.status).toBe(200);
    expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ token: 'mytoken' });
  });

  it('returns 200 and logs the logout when a valid auth token is provided', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken: 'mytoken' });
    expect(res.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGOUT' }));
  });
});

// ── GET /auth/activate/:token ─────────────────────────────────────────────────

describe('GET /auth/activate/:token', () => {
  it('returns 200 and activates the account with a valid token', async () => {
    const mockUser = { _id: 'uid1', username: 'testuser', save: jest.fn() };
    User.findOne.mockResolvedValue(mockUser);
    User.findByIdAndUpdate.mockResolvedValue({ ...mockUser, isVerified: true });

    const res = await request(app).get('/auth/activate/validtoken123');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/activated/i);
  });

  it('returns 400 for an invalid or expired activation token', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).get('/auth/activate/badtoken');
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  it('returns 200 with the same message regardless of whether email exists', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/auth/forgot-password').send({ email: 'unknown@nexus.com' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 200 and triggers reset flow when user exists', async () => {
    const mockUser = { _id: 'uid1', username: 'testuser', email: 'test@nexus.com' };
    User.findOne.mockResolvedValue(mockUser);
    User.findByIdAndUpdate.mockResolvedValue(mockUser);

    const res = await request(app).post('/auth/forgot-password').send({ email: 'test@nexus.com' });
    expect(res.status).toBe(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/reset-password/:token ─────────────────────────────────────────

describe('POST /auth/reset-password/:token', () => {
  const mockUser = { _id: 'uid1', username: 'testuser', email: 'test@nexus.com' };

  it('returns 200 with success message on valid token', async () => {
    User.findOne.mockResolvedValue(mockUser);
    User.findByIdAndUpdate.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/auth/reset-password/validresettoken')
      .send({ newPassword: 'newSecret123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset/i);
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    expect(RefreshToken.deleteMany).toHaveBeenCalled();
  });

  it('returns 400 for invalid or expired reset token', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/reset-password/expiredtoken')
      .send({ newPassword: 'newSecret123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when new password is too short', async () => {
    const res = await request(app)
      .post('/auth/reset-password/sometoken')
      .send({ newPassword: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app)
      .post('/auth/reset-password/sometoken')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── PUT /auth/change-password ─────────────────────────────────────────────────

describe('PUT /auth/change-password', () => {
  const hashed   = bcrypt.hashSync('oldPass123', 10);
  const mockUser = { _id: 'uid1', username: 'testuser', email: 'test@nexus.com', password: hashed };

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .put('/auth/change-password')
      .send({ currentPassword: 'oldPass123', newPassword: 'newPass456' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when auth token is invalid', async () => {
    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', 'Bearer invalidtoken')
      .send({ currentPassword: 'oldPass123', newPassword: 'newPass456' });
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful password change', async () => {
    const token = makeToken();
    User.findById.mockResolvedValue(mockUser);
    User.findByIdAndUpdate.mockResolvedValue(mockUser);

    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldPass123', newPassword: 'newPass456' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/changed/i);
  });

  it('returns 400 when current password is wrong', async () => {
    const token = makeToken();
    User.findById.mockResolvedValue(mockUser);

    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongOldPass', newPassword: 'newPass456' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when new password is too short', async () => {
    const token = makeToken();
    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldPass123', newPassword: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when currentPassword is missing', async () => {
    const token = makeToken();
    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'newPass456' });
    expect(res.status).toBe(400);
  });
});

// ── GET /auth/users (admin only) ──────────────────────────────────────────────

describe('GET /auth/users', () => {
  const adminToken    = makeToken({ role: 'admin' });
  const employeeToken = makeToken({ role: 'employee' });
  const mockUsers     = [{ _id: 'u1', username: 'alice', email: 'alice@test.com', role: 'employee' }];

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/auth/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    const res = await request(app).get('/auth/users').set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with users list for admin', async () => {
    User.find.mockReturnValue(mockChain(mockUsers));
    User.countDocuments.mockResolvedValue(1);

    const res = await request(app).get('/auth/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('total');
  });

  it('supports role filter in query params', async () => {
    User.find.mockReturnValue(mockChain([]));
    User.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/auth/users?role=admin').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('supports pagination params', async () => {
    User.find.mockReturnValue(mockChain(mockUsers));
    User.countDocuments.mockResolvedValue(10);

    const res = await request(app).get('/auth/users?page=2&limit=5').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPages');
  });
});

// ── PUT /auth/users/:id/role (admin only) ─────────────────────────────────────

describe('PUT /auth/users/:id/role', () => {
  const adminToken = makeToken({ role: 'admin' });
  const mockUser   = { _id: 'uid2', username: 'bob', email: 'bob@test.com', role: 'employee' };

  it('returns 401 without auth token', async () => {
    const res = await request(app).put('/auth/users/uid2/role').send({ role: 'manager' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    const employeeToken = makeToken({ role: 'employee' });
    const res = await request(app)
      .put('/auth/users/uid2/role')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ role: 'manager' });
    expect(res.status).toBe(403);
  });

  it('returns 200 when admin updates a user role', async () => {
    User.findByIdAndUpdate.mockResolvedValue({ ...mockUser, role: 'manager' });

    const res = await request(app)
      .put('/auth/users/uid2/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  it('returns 404 when user does not exist', async () => {
    User.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put('/auth/users/nonexistent/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid role value', async () => {
    const res = await request(app)
      .put('/auth/users/uid2/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when role field is missing', async () => {
    const res = await request(app)
      .put('/auth/users/uid2/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── DELETE /auth/users/:id (admin only) ───────────────────────────────────────

describe('DELETE /auth/users/:id', () => {
  const adminToken = makeToken({ role: 'admin' });
  const mockUser   = { _id: 'uid2', email: 'bob@test.com' };

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/auth/users/uid2');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const managerToken = makeToken({ role: 'manager' });
    const res = await request(app)
      .delete('/auth/users/uid2')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 when admin deletes a user', async () => {
    User.findByIdAndDelete.mockResolvedValue(mockUser);

    const res = await request(app)
      .delete('/auth/users/uid2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ userId: 'uid2' });
  });

  it('returns 404 when user does not exist', async () => {
    User.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete('/auth/users/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /auth/audit-logs (admin only) ────────────────────────────────────────

describe('GET /auth/audit-logs', () => {
  const adminToken    = makeToken({ role: 'admin' });
  const employeeToken = makeToken({ role: 'employee' });
  const mockLogs      = [{ _id: 'log1', action: 'LOGIN', userId: 'uid1', timestamp: new Date() }];

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/auth/audit-logs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app).get('/auth/audit-logs').set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with audit logs for admin', async () => {
    AuditLog.find.mockReturnValue(mockChain(mockLogs));
    AuditLog.countDocuments.mockResolvedValue(1);

    const res = await request(app).get('/auth/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(res.body).toHaveProperty('total');
  });

  it('supports userId and action filter params', async () => {
    AuditLog.find.mockReturnValue(mockChain([]));
    AuditLog.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get('/auth/audit-logs?userId=uid1&action=LOGIN')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
