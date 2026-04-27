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

const app = express();
app.use(express.json());
app.use('/auth', require('../routes/auth'));

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.create.mockResolvedValue({});
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
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  const hashed = bcrypt.hashSync('secret123', 10);
  // isVerified: true — verified users can log in; undefined also passes (legacy accounts)
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
    RefreshToken.deleteOne = jest.fn().mockResolvedValue({});
    const res = await request(app).post('/auth/logout').send({});
    expect(res.status).toBe(200);
  });

  it('returns 200 and deletes the provided refresh token', async () => {
    RefreshToken.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const res = await request(app).post('/auth/logout').send({ refreshToken: 'mytoken' });
    expect(res.status).toBe(200);
    expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ token: 'mytoken' });
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
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});
