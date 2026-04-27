const employeeRepository = require('../../infrastructure/repositories/EmployeeRepository');

const serviceError = (message, status) => Object.assign(new Error(message), { status });

class EmployeeService {
  async listEmployees({ page = 1, limit = 20, status, departmentId, managerId, search } = {}) {
    return employeeRepository.findAll({ page, limit, status, departmentId, managerId, search });
  }

  async getEmployee(id) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw serviceError('Employee not found', 404);
    return employee;
  }

  async getEmployeeByEmail(email) {
    const employee = await employeeRepository.findByEmail(email);
    if (!employee) throw serviceError('No employee record linked to your account', 404);
    return employee;
  }

  async createEmployee(data) {
    return employeeRepository.create(data);
  }

  async updateEmployee(id, data) {
    const employee = await employeeRepository.update(id, data);
    if (!employee) throw serviceError('Employee not found', 404);
    return employee;
  }

  async deleteEmployee(id) {
    const employee = await employeeRepository.delete(id);
    if (!employee) throw serviceError('Employee not found', 404);
    return { message: 'Employee deleted successfully' };
  }
}

module.exports = new EmployeeService();
