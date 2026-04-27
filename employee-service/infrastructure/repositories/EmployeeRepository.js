const { Op }     = require('sequelize');
const IEmployeeRepository = require('../../domain/repositories/IEmployeeRepository');
const Employee   = require('../../models/Employee');
const Department = require('../../models/Department');

const includeAssociations = [
  { model: Department, as: 'department', attributes: ['id', 'name'] },
  { model: Employee,   as: 'manager',    attributes: ['id', 'firstName', 'lastName'] },
];

// SQLite (tests) does not support iLike; Postgres does
const likeOp = process.env.NODE_ENV === 'test' ? Op.like : Op.iLike;

class EmployeeRepository extends IEmployeeRepository {
  async findAll({ page = 1, limit = 20, status, departmentId, managerId, search } = {}) {
    const skip  = (page - 1) * limit;
    const where = {};

    if (status)       where.status       = status;
    if (departmentId) where.departmentId = departmentId;
    if (managerId)    where.managerId    = managerId;
    if (search) {
      where[Op.or] = [
        { firstName: { [likeOp]: `%${search}%` } },
        { lastName:  { [likeOp]: `%${search}%` } },
        { email:     { [likeOp]: `%${search}%` } },
        { position:  { [likeOp]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Employee.findAndCountAll({
      where,
      include: includeAssociations,
      order:   [['createdAt', 'DESC']],
      offset:  skip,
      limit:   Number(limit),
      distinct: true,
    });

    return {
      employees:  rows,
      total:      count,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
    };
  }

  async findById(id) {
    return Employee.findByPk(id, { include: includeAssociations });
  }

  async findByEmail(email) {
    return Employee.findOne({ where: { email }, include: includeAssociations });
  }

  async create(data) {
    const employee = await Employee.create(data);
    return Employee.findByPk(employee.id, { include: includeAssociations });
  }

  async update(id, data) {
    const employee = await Employee.findByPk(id);
    if (!employee) return null;
    await employee.update(data);
    return Employee.findByPk(id, { include: includeAssociations });
  }

  async delete(id) {
    const employee = await Employee.findByPk(id);
    if (!employee) return null;
    await employee.destroy();
    return employee;
  }
}

module.exports = new EmployeeRepository();
