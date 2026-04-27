class IRefreshTokenRepository {
  async findByToken(token) { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  async deleteByToken(token) { throw new Error('Not implemented'); }
  async deleteByUserId(userId) { throw new Error('Not implemented'); }
}

module.exports = IRefreshTokenRepository;
