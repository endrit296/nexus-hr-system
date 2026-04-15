const express = require('express');
const Joi = require('joi');
const Employee = require('../models/Employee');
const Department = require('../models/Department');

const router = express.Router();

const employeeSchema = Joi.object({
  firstName:    Joi.string().trim().required(),
  lastName:     Joi.string().trim().required(),
  email:        Joi.string().email().required(),
  phone:        Joi.string().trim().allow('', null),
  position:     Joi.string().trim().allow('', null),
  status:       Joi.string().valid('active', 'inactive', 'on_leave').default('active'),
  hireDate:     Joi.date().allow(null),
  salary:       Joi.number().positive().allow(null),
  departmentId: Joi.number().integer().positive().allow(null),
  managerId:    Joi.number().integer().positive().allow(null),
});

const employeeUpdateSchema = employeeSchema.fork(
  ['firstName', 'lastName', 'email'],
  (field) => field.optional()
);

const includeAssociations = [
  { model: Department, as: 'department', attributes: ['id', 'name'] },
  { model: Employee,   as: 'manager',    attributes: ['id', 'firstName', 'lastName'] },
];

// GET /employees — list all
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: includeAssociations,
      order: [['createdAt', 'DESC']],
    });
    res.json({ status: 'ok', employees });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /employees/:id
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, { include: includeAssociations });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /employees — create
router.post('/', async (req, res) => {
  const { error, value } = employeeSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const employee = await Employee.create(value);
    const full = await Employee.findByPk(employee.id, { include: includeAssociations });
    res.status(201).json(full);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /employees/:id — update
router.put('/:id', async (req, res) => {
  const { error, value } = employeeUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    await employee.update(value);
    const full = await Employee.findByPk(employee.id, { include: includeAssociations });
    res.json(full);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /employees/:id
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    await employee.destroy();
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
