const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const Joi      = require('joi');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const router = express.Router();

const JWT_SECRET          = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';
const ACCESS_TOKEN_TTL    = '15m';                          // short-lived
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;     // 7 days in ms

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

// ── Helpers ──────────────────────────────────────────────────────────────────

const signAccessToken = (user) =>
  jwt.sign(
    { userId: user._id, username: user.username, role: user.role || 'employee', email: user.email },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const createRefreshToken = async (userId) => {
  const token     = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await RefreshToken.create({ token, userId, expiresAt });
  return token;
};

// ── POST /auth/register ──────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { username, email, password } = value;

  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });

    const accessToken  = signAccessToken(user);
    const refreshToken = await createRefreshToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token:        accessToken,
      refreshToken,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = value;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const accessToken  = signAccessToken(user);
    const refreshToken = await createRefreshToken(user._id);

    res.json({
      message: 'Login successful',
      token:        accessToken,
      refreshToken,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(stored.userId);
    if (!user) return res.status(403).json({ message: 'User not found' });

    const newAccessToken = signAccessToken(user);

    res.json({ token: newAccessToken });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── Auth middleware (used only for admin routes below) ───────────────────────

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ── GET /auth/users — list all users (admin only) ────────────────────────────

router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /auth/users/:id/role — assign role (admin only) ──────────────────────

const roleSchema = Joi.object({
  role: Joi.string().valid('employee', 'manager', 'admin').required(),
});

router.put('/users/:id/role', verifyAdmin, async (req, res) => {
  const { error, value } = roleSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: value.role },
      { new: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Role updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
