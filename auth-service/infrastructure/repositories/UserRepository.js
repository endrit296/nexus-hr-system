const IUserRepository = require('../../domain/repositories/IUserRepository');
const User = require('../../models/User');

class UserRepository extends IUserRepository {
  async findById(id) {
    return User.findById(id, { password: 0 });
  }

  async findByIdWithPassword(id) {
    return User.findById(id);
  }

  async findByEmail(email) {
    return User.findOne({ email });
  }

  async findByUsername(username) {
    return User.findOne({ username });
  }

  async findByActivationToken(token) {
    return User.findOne({
      activationToken: token,
      activationTokenExpiry: { $gt: new Date() },
    });
  }

  async findByResetToken(token) {
    return User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() },
    });
  }

  async findAll({ page = 1, limit = 20, role } = {}) {
    const skip = (page - 1) * limit;
    const filter = {};
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter, { password: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return { users, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  }

  async create(data) {
    return User.create(data);
  }

  async update(id, data) {
    return User.findByIdAndUpdate(id, data, { new: true, projection: { password: 0 } });
  }

  async delete(id) {
    return User.findByIdAndDelete(id);
  }
}

module.exports = new UserRepository();
