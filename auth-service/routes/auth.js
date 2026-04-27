const express = require('express');
const jwt     = require('jsonwebtoken');
const Joi     = require('joi');

const authService = require('../application/services/AuthService');
const userService = require('../application/services/UserService');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';

// ── Validation schemas ───────────────────────────────────────────────────────

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).trim().required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword:     Joi.string().min(6).required(),
});

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const roleSchema = Joi.object({
  role: Joi.string().valid('employee', 'manager', 'admin').required(),
});

// ── Middleware ───────────────────────────────────────────────────────────────

const verifyAuth = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};

const ip = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    res.status(result._status || 200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// ── POST /auth/register ──────────────────────────────────────────────────────

router.post('/register', handle(async (req) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) return Object.assign({ message: error.details[0].message }, { _status: 400 });
  const result = await authService.register({ ...value, ipAddress: ip(req) });
  return Object.assign(result, { _status: 201 });
}));

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', handle(async (req) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return Object.assign({ message: error.details[0].message }, { _status: 400 });
  return authService.login({ ...value, ipAddress: ip(req) });
}));

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', handle(async (req) => {
  const { refreshToken } = req.body;
  const token = (req.headers['authorization'] || '').split(' ')[1];
  let userId, username;
  try {
    const decoded = token ? jwt.verify(token, JWT_SECRET) : null;
    userId   = decoded?.userId;
    username = decoded?.username;
  } catch { /* token may be expired on logout — that's fine */ }
  return authService.logout({ refreshToken, userId, username, ipAddress: ip(req) });
}));

// ── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', handle(async (req) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return Object.assign({ message: 'Refresh token required' }, { _status: 401 });
  return authService.refresh({ refreshToken });
}));

// ── GET /auth/activate/:token ────────────────────────────────────────────────

router.get('/activate/:token', handle(async (req) => {
  return authService.activateAccount({ token: req.params.token });
}));

// ── POST /auth/forgot-password ───────────────────────────────────────────────

router.post('/forgot-password', handle(async (req) => {
  const { error, value } = forgotPasswordSchema.validate(req.body);
  if (error) return Object.assign({ message: error.details[0].message }, { _status: 400 });
  return authService.forgotPassword({ email: value.email });
}));

// ── POST /auth/reset-password/:token ─────────────────────────────────────────

router.post('/reset-password/:token', handle(async (req) => {
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) return Object.assign({ message: error.details[0].message }, { _status: 400 });
  return authService.resetPassword({ token: req.params.token, newPassword: value.newPassword });
}));

// ── PUT /auth/change-password (requires auth) ────────────────────────────────

router.put('/change-password', verifyAuth, handle(async (req) => {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) return Object.assign({ message: error.details[0].message }, { _status: 400 });
  return authService.changePassword({
    userId:          req.user.userId,
    currentPassword: value.currentPassword,
    newPassword:     value.newPassword,
    ipAddress:       ip(req),
  });
}));

// ── GET /auth/users — list all users with pagination (admin only) ─────────────

router.get('/users', verifyAdmin, handle(async (req) => {
  const { page = 1, limit = 20, role } = req.query;
  return userService.listUsers({ page, limit, role });
}));

// ── PUT /auth/users/:id/role — assign role (admin only) ──────────────────────

router.put('/users/:id/role', verifyAdmin, handle(async (req) => {
  const { error, value } = roleSchema.validate(req.body);
  if (error) return Object.assign({ message: error.details[0].message }, { _status: 400 });
  return userService.updateRole({
    targetUserId:  req.params.id,
    role:          value.role,
    adminId:       req.user.userId,
    adminUsername: req.user.username,
    ipAddress:     ip(req),
  });
}));

// ── DELETE /auth/users/:id — delete user (admin only) ────────────────────────

router.delete('/users/:id', verifyAdmin, handle(async (req) => {
  return userService.deleteUser({
    targetUserId:  req.params.id,
    adminId:       req.user.userId,
    adminUsername: req.user.username,
    ipAddress:     ip(req),
  });
}));

// ── GET /auth/audit-logs — get audit trail (admin only) ──────────────────────

router.get('/audit-logs', verifyAdmin, handle(async (req) => {
  const { page = 1, limit = 50, userId, action } = req.query;
  return userService.getAuditLogs({ page, limit, userId, action });
}));

module.exports = router;
