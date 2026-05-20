// Brute-force / rate-limiting tests for POST /auth/login.
//
// The auth service applies express-rate-limit (5 attempts per 15 minutes per
// IP+email) to the login endpoint.  In test mode that limiter is skipped so
// the existing test suite (auth.test.js) is unaffected.  Here we mount a
// dedicated test limiter with no skip condition to verify the behaviour.
//
// Config: 5 attempts per 60-second window, keyed on IP + email.

jest.mock('../../models/User');
jest.mock('../../models/RefreshToken');
jest.mock('../../models/AuditLog');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

const express      = require('express');
const rateLimit    = require('express-rate-limit');
const request      = require('supertest');
const User         = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const AuditLog     = require('../../models/AuditLog');

// Fresh rate limiter for this test file — no skip condition.
const TEST_MAX = 5;
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: TEST_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
  message: { message: 'Too many login attempts, please try again later' },
  skip: () => false, // never skip — this is the point of the test
});

// Build a test app that applies the rate limiter before the auth routes.
// The auth router's own limiter is skipped (NODE_ENV=test), so only the
// test limiter fires.
function buildApp() {
  const app = express();
  app.use(express.json());
  // Mount rate limiter specifically on the login path before the router.
  app.use('/auth/login', (req, res, next) => loginRateLimiter(req, res, next));
  app.use('/auth', require('../../routes/auth'));
  return app;
}

const app = buildApp();

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.create.mockResolvedValue({});
  RefreshToken.deleteMany = jest.fn().mockResolvedValue({});
  RefreshToken.deleteOne  = jest.fn().mockResolvedValue({});
  // Return null so every login attempt fails with 401 (not found).
  User.findOne.mockResolvedValue(null);
});

describe('POST /auth/login — brute-force rate limiting', () => {

  it(`allows exactly ${TEST_MAX} attempts before triggering rate limit`, async () => {
    const body = { email: 'victim@test.com', password: 'wrong' };

    const statuses = [];
    for (let i = 0; i < TEST_MAX + 1; i++) {
      const res = await request(app).post('/auth/login').send(body);
      statuses.push(res.status);
    }

    // First TEST_MAX requests: auth fails (401) — NOT rate limited yet.
    for (let i = 0; i < TEST_MAX; i++) {
      expect(statuses[i]).toBe(401);
    }
    // Request TEST_MAX + 1: rate limiter fires.
    expect(statuses[TEST_MAX]).toBe(429);
  });

  it('returns 429 on every request after the limit is exceeded', async () => {
    const body = { email: 'victim2@test.com', password: 'wrong' };

    // Exhaust the limit.
    for (let i = 0; i < TEST_MAX; i++) {
      await request(app).post('/auth/login').send(body);
    }

    // The next 15 attempts should all be 429.
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/auth/login').send(body);
      expect(res.status).toBe(429);
    }
  });

  it('429 response contains a rate-limit message', async () => {
    const body = { email: 'victim3@test.com', password: 'wrong' };

    for (let i = 0; i < TEST_MAX; i++) {
      await request(app).post('/auth/login').send(body);
    }

    const res = await request(app).post('/auth/login').send(body);
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/too many login/i);
  });

  it('429 response includes RateLimit standard headers', async () => {
    const body = { email: 'victim4@test.com', password: 'wrong' };

    for (let i = 0; i < TEST_MAX; i++) {
      await request(app).post('/auth/login').send(body);
    }

    const res = await request(app).post('/auth/login').send(body);
    expect(res.status).toBe(429);
    // RateLimit-Limit or X-RateLimit-Limit should be present.
    const hasRateLimitHeader =
      res.headers['ratelimit-limit'] !== undefined ||
      res.headers['x-ratelimit-limit'] !== undefined;
    expect(hasRateLimitHeader).toBe(true);
  });

  it('different email addresses have independent rate-limit counters', async () => {
    // Exhaust the limit for victim5.
    for (let i = 0; i < TEST_MAX; i++) {
      await request(app).post('/auth/login').send({ email: 'victim5@test.com', password: 'x' });
    }
    // victim5 is now rate-limited.
    const res5 = await request(app).post('/auth/login').send({ email: 'victim5@test.com', password: 'x' });
    expect(res5.status).toBe(429);

    // victim6 should still be under the limit.
    const res6 = await request(app).post('/auth/login').send({ email: 'victim6@test.com', password: 'x' });
    expect(res6.status).toBe(401); // 401 = auth failure, NOT rate-limited
  });

});
