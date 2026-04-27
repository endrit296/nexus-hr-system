const { Op }     = require('sequelize');
const IDepartmentRepository = require('../../domain/repositories/IDepartmentRepository');
const Department = require('../../models/Department');
const Employee   = require('../../models/Employee');

const serviceError = (message, status) => Object.assign(new Error(message), { status });
const likeOp = process.env.NODE_ENV === 'test' ? Op.like : Op.iLike;

class DepartmentRepository extends IDepartmentRepository {
  async findAll({ page = 1, limit = 50, search } = {}) {
    const skip  = (page - 1) * limit;
    const where = {};
    if (search) where.name = { [likeOp]: `%${search}%` };

    const { rows, count } = await Department.findAndCountAll({
      where,
      order:  [['name', 'ASC']],
      offset: skip,
      limit:  Number(limit),
    });

    // Attach employee counts in one batch query
    const deptIds  = rows.map((d) => d.id);
    const empCounts = await Employee.findAll({
      where:      { departmentId: deptIds },
      attributes: ['departmentId'],
    });

    const countMap = {};
    empCounts.forEach((e) => {
      countMap[e.departmentId] = (countMap[e.departmentId] || 0) + 1;
    });

    return {
      departments: rows.map((d) => ({ ...d.toJSON(), employeeCount: countMap[d.id] || 0 })),
      total:       count,
      page:        Number(page),
      limit:       Number(limit),
      totalPages:  Math.ceil(count / Number(limit)),
    };
  }

  async findById(id) {
    return Department.findByPk(id);
  }

  async create(data) {
    return Department.create(data);
  }

  async delete(id) {
    const dept = await Department.findByPk(id);
    if (!dept) return null;

    const count = await Employee.count({ where: { departmentId: id } });
    if (count > 0) {
      throw serviceError(`Cannot delete: ${count} employee(s) still assigned to this department`, 400);
    }

    await dept.destroy();
    return dept;
  }
}

module.exports = new DepartmentRepository();
