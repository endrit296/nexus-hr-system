// Negative input tests for auth-service routes.
// These complement auth.test.js by focusing on malformed, missing, and boundary inputs.

jest.mock('../models/User');
jest.mock('../models/RefreshToken');
jest.mock('../models/AuditLog');

const express      = require('express');
const request      = require('supertest');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog     = require('../models/AuditLog');

const app = express();
app.use(express.json());
app.use('/auth', require('../routes/auth'));

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.create.mockResolvedValue({});
  RefreshToken.deleteMany = jest.fn().mockResolvedValue({});
  RefreshToken.deleteOne  = jest.fn().mockResolvedValue({});
});

// ── POST /auth/register — negative ───────────────────────────────────────────

describe('POST /auth/register — negative inputs', () => {
  it('returns 400 when body is completely empty', async () => {
    const res = await request(app).post('/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when email format is invalid (missing @)', async () => {
    const res = await request(app).post('/auth/register')
      .send({ username: 'user1', email: 'notanemail', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns 400 when email is a number instead of string', async () => {
    const res = await request(app).post('/auth/register')
      .send({ username: 'user1', email: 12345, password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is exactly 5 characters (boundary — too short)', async () => {
    const res = await request(app).post('/auth/register')
      .send({ username: 'user1', email: 'a@b.com', password: '12345' });
    expect(res.status).toBe(400);
  });

  it('returns 201 when password is exactly 6 characters (boundary — min valid)', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'uid1', username: 'user1', email: 'a@b.com', role: 'employee' });
    const res = await request(app).post('/auth/register')
      .send({ username: 'user1', email: 'a@b.com', password: '123456' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when username is exactly 2 characters (boundary — too short)', async () => {
    const res = await request(app).post('/auth/register')
      .send({ username: 'ab', email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('returns 201 when username is exactly 3 characters (boundary — min valid)', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'uid1', username: 'abc', email: 'abc@b.com', role: 'employee' });
    const res = await request(app).post('/auth/register')
      .send({ username: 'abc', email: 'abc@b.com', password: 'secret123' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when username is missing but other fields are valid', async () => {
    const res = await request(app).post('/auth/register')
      .send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing but other fields are valid', async () => {
    const res = await request(app).post('/auth/register')
      .send({ username: 'user1', email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON with correct Content-Type', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('{ not valid json }');
    // Express json() middleware rejects malformed JSON with 400
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/login — negative ───────────────────────────────────────────────

describe('POST /auth/login — negative inputs', () => {
  it('returns 400 when body is completely empty', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'secret' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is not a valid email format', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email: 'plaintext', password: 'secret' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns 400 when email is null', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email: null, password: 'secret' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('invalid json here');
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/forgot-password — negative ─────────────────────────────────────

describe('POST /auth/forgot-password — negative inputs', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when email format is invalid', async () => {
    const res = await request(app).post('/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is a number', async () => {
    const res = await request(app).post('/auth/forgot-password')
      .send({ email: 99999 });
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/reset-password/:token — negative ───────────────────────────────

describe('POST /auth/reset-password/:token — negative inputs', () => {
  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app).post('/auth/reset-password/some-token').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is shorter than 6 characters', async () => {
    const res = await request(app).post('/auth/reset-password/some-token')
      .send({ newPassword: '12345' });
    expect(res.status).toBe(400);
  });
});

// ── PUT /auth/change-password — negative ─────────────────────────────────────

describe('PUT /auth/change-password — negative inputs', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).put('/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'newpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when currentPassword is missing from body', async () => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';
    const token = jwt.sign({ userId: 'uid1', role: 'employee' }, JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'newpassword' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is too short', async () => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';
    const token = jwt.sign({ userId: 'uid1', role: 'employee' }, JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old', newPassword: '123' });
    expect(res.status).toBe(400);
  });
});
