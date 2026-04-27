const IAuditLogRepository = require('../../domain/repositories/IAuditLogRepository');
const AuditLog = require('../../models/AuditLog');

class AuditLogRepository extends IAuditLogRepository {
  async create(data) {
    return AuditLog.create(data);
  }

  async findAll({ page = 1, limit = 50, userId, action } = {}) {
    const skip = (page - 1) * limit;
    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return { logs, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  }

  async findByUserId(userId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({ userId }).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments({ userId }),
    ]);

    return { logs, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  }
}

module.exports = new AuditLogRepository();
