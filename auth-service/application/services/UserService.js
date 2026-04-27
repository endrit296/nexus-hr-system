const userRepository         = require('../../infrastructure/repositories/UserRepository');
const refreshTokenRepository = require('../../infrastructure/repositories/RefreshTokenRepository');
const auditLogRepository     = require('../../infrastructure/repositories/AuditLogRepository');

const serviceError = (message, status) => Object.assign(new Error(message), { status });

class UserService {
  async listUsers({ page = 1, limit = 20, role } = {}) {
    return userRepository.findAll({ page: Number(page), limit: Number(limit), role });
  }

  async updateRole({ targetUserId, role, adminId, adminUsername, ipAddress }) {
    const user = await userRepository.update(targetUserId, { role });
    if (!user) throw serviceError('User not found', 404);

    await auditLogRepository.create({
      userId: adminId, username: adminUsername, action: 'ROLE_CHANGE',
      details: { targetUserId, newRole: role }, ipAddress,
    });

    return { message: 'Role updated', user };
  }

  async deleteUser({ targetUserId, adminId, adminUsername, ipAddress }) {
    const user = await userRepository.delete(targetUserId);
    if (!user) throw serviceError('User not found', 404);

    await refreshTokenRepository.deleteByUserId(targetUserId);

    await auditLogRepository.create({
      userId: adminId, username: adminUsername, action: 'DELETE_USER',
      details: { deletedUserId: targetUserId, deletedEmail: user.email }, ipAddress,
    });

    return { message: 'User deleted successfully' };
  }

  async getAuditLogs({ page = 1, limit = 50, userId, action } = {}) {
    return auditLogRepository.findAll({
      page: Number(page), limit: Number(limit), userId, action,
    });
  }
}

module.exports = new UserService();
