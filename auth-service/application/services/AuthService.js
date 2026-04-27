const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');

const userRepository         = require('../../infrastructure/repositories/UserRepository');
const refreshTokenRepository = require('../../infrastructure/repositories/RefreshTokenRepository');
const auditLogRepository     = require('../../infrastructure/repositories/AuditLogRepository');
const emailService           = require('../../infrastructure/email/EmailService');

const JWT_SECRET           = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';
const ACCESS_TOKEN_TTL     = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const signAccessToken = (user) =>
  jwt.sign(
    { userId: user._id, username: user.username, role: user.role || 'employee', email: user.email },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const serviceError = (message, status) => Object.assign(new Error(message), { status });

class AuthService {
  async register({ username, email, password, ipAddress }) {
    const [existingEmail, existingUsername] = await Promise.all([
      userRepository.findByEmail(email),
      userRepository.findByUsername(username),
    ]);
    if (existingEmail || existingUsername) {
      throw serviceError('Username or email already in use', 409);
    }

    const hashedPassword       = await bcrypt.hash(password, 10);
    const activationToken      = crypto.randomBytes(32).toString('hex');
    const activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await userRepository.create({
      username,
      email,
      password: hashedPassword,
      isVerified: false,
      activationToken,
      activationTokenExpiry,
    });

    await emailService.sendActivationEmail(user, activationToken);

    await auditLogRepository.create({
      userId: user._id, username: user.username, action: 'REGISTER', details: { email }, ipAddress,
    });

    return { message: 'Registration successful. Please check your email to activate your account.' };
  }

  async login({ email, password, ipAddress }) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw serviceError('Invalid email or password', 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await auditLogRepository.create({
        userId: user._id, username: user.username, action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' }, ipAddress,
      });
      throw serviceError('Invalid email or password', 401);
    }

    // isVerified === false means new unverified user; null/undefined means legacy user — allow through
    if (user.isVerified === false) {
      throw serviceError('Please verify your email address before logging in', 403);
    }

    const accessToken  = signAccessToken(user);
    const rawToken     = crypto.randomBytes(40).toString('hex');
    const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await refreshTokenRepository.create({ token: rawToken, userId: user._id, expiresAt });

    await auditLogRepository.create({
      userId: user._id, username: user.username, action: 'LOGIN', details: { email }, ipAddress,
    });

    return {
      message: 'Login successful',
      token:        accessToken,
      refreshToken: rawToken,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    };
  }

  async logout({ refreshToken, userId, username, ipAddress }) {
    if (refreshToken) await refreshTokenRepository.deleteByToken(refreshToken);

    if (userId) {
      await auditLogRepository.create({ userId, username, action: 'LOGOUT', ipAddress });
    }

    return { message: 'Logged out successfully' };
  }

  async refresh({ refreshToken }) {
    const stored = await refreshTokenRepository.findByToken(refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
      throw serviceError('Invalid or expired refresh token', 403);
    }

    const user = await userRepository.findById(stored.userId);
    if (!user) throw serviceError('User not found', 403);

    return { token: signAccessToken(user) };
  }

  async activateAccount({ token }) {
    const user = await userRepository.findByActivationToken(token);
    if (!user) throw serviceError('Invalid or expired activation token', 400);

    await userRepository.update(user._id, {
      isVerified: true,
      activationToken: null,
      activationTokenExpiry: null,
    });

    await auditLogRepository.create({
      userId: user._id, username: user.username, action: 'ACTIVATE',
    });

    return { message: 'Account activated successfully. You can now log in.' };
  }

  async forgotPassword({ email }) {
    const user = await userRepository.findByEmail(email);
    // Always return the same message to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    await userRepository.update(user._id, {
      resetPasswordToken: resetToken,
      resetPasswordExpiry: new Date(Date.now() + 60 * 60 * 1000),
    });

    await emailService.sendPasswordResetEmail(user, resetToken);

    await auditLogRepository.create({
      userId: user._id, username: user.username, action: 'PASSWORD_RESET_REQUESTED', details: { email },
    });

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword({ token, newPassword }) {
    const user = await userRepository.findByResetToken(token);
    if (!user) throw serviceError('Invalid or expired reset token', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user._id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
    });

    await refreshTokenRepository.deleteByUserId(user._id);

    await auditLogRepository.create({
      userId: user._id, username: user.username, action: 'PASSWORD_RESET',
    });

    return { message: 'Password reset successfully. Please log in again.' };
  }

  async changePassword({ userId, currentPassword, newPassword, ipAddress }) {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) throw serviceError('User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw serviceError('Current password is incorrect', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userId, { password: hashedPassword });

    await refreshTokenRepository.deleteByUserId(userId);

    await auditLogRepository.create({
      userId: user._id, username: user.username, action: 'PASSWORD_CHANGE', ipAddress,
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }
}

module.exports = new AuthService();
