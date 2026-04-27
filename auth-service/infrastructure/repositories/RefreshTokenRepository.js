const IRefreshTokenRepository = require('../../domain/repositories/IRefreshTokenRepository');
const RefreshToken = require('../../models/RefreshToken');

class RefreshTokenRepository extends IRefreshTokenRepository {
  async findByToken(token) {
    return RefreshToken.findOne({ token });
  }

  async create({ token, userId, expiresAt }) {
    return RefreshToken.create({ token, userId, expiresAt });
  }

  async deleteByToken(token) {
    return RefreshToken.deleteOne({ token });
  }

  async deleteByUserId(userId) {
    return RefreshToken.deleteMany({ userId });
  }
}

module.exports = new RefreshTokenRepository();
