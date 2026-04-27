class IAuditLogRepository {
  async create(data) { throw new Error('Not implemented'); }
  async findAll(options) { throw new Error('Not implemented'); }
  async findByUserId(userId, options) { throw new Error('Not implemented'); }
}

module.exports = IAuditLogRepository;
