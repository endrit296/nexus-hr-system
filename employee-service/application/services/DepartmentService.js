const departmentRepository = require('../../infrastructure/repositories/DepartmentRepository');

const serviceError = (message, status) => Object.assign(new Error(message), { status });

class DepartmentService {
  async listDepartments({ page = 1, limit = 50, search } = {}) {
    return departmentRepository.findAll({ page, limit, search });
  }

  async getDepartment(id) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw serviceError('Department not found', 404);
    return dept;
  }

  async createDepartment(data) {
    return departmentRepository.create(data);
  }

  async deleteDepartment(id) {
    const dept = await departmentRepository.delete(id);
    if (!dept) throw serviceError('Department not found', 404);
    return { message: 'Department deleted successfully' };
  }
}

module.exports = new DepartmentService();
