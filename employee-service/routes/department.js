const express = require('express');
const Joi = require('joi');
const Department = require('../models/Department');
const Employee = require('../models/Employee');

const router = express.Router();

const departmentSchema = Joi.object({
  name: Joi.string().trim().required(),
});

// GET /departments — list all with employee count
router.get('/', async (req, res) => {
  try {
    const departments = await Department.findAll({ order: [['name', 'ASC']] });
    const employees = await Employee.findAll({ attributes: ['departmentId'] });

    const countMap = {};
    employees.forEach((e) => {
      if (e.departmentId) countMap[e.departmentId] = (countMap[e.departmentId] || 0) + 1;
    });

    const result = departments.map((d) => ({ ...d.toJSON(), employeeCount: countMap[d.id] || 0 }));
    res.json({ status: 'ok', departments: result });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /departments — create
router.post('/', async (req, res) => {
  const { error, value } = departmentSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const dept = await Department.create(value);
    res.status(201).json(dept);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /departments/:id — only if no employees assigned
router.delete('/:id', async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    const count = await Employee.count({ where: { departmentId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ message: `Cannot delete: ${count} employee(s) still assigned to this department` });
    }

    await dept.destroy();
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
