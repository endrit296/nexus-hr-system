const express    = require('express');
const Joi        = require('joi');
const Employee   = require('../models/Employee');
const Department = require('../models/Department');
const { requireRole } = require('../middleware/auth');

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

// GET /employees — all authenticated users can browse the directory
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

// GET /employees/:id — all authenticated users
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, { include: includeAssociations });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /employees — admin only
router.post('/', requireRole('admin'), async (req, res) => {
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

// PUT /employees/:id
//   admin  → full update
//   manager → only their direct subordinates; salary, departmentId, managerId are stripped
router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const role      = req.headers['x-user-role'];
  const userEmail = req.headers['x-user-email'];

  const { error, value } = employeeUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (role === 'manager') {
      // Resolve the manager's own employee record by matching their auth email
      const managerRecord = await Employee.findOne({ where: { email: userEmail } });
      if (!managerRecord) {
        return res.status(403).json({
          message: 'Your account is not linked to an employee record',
        });
      }
      if (employee.managerId !== managerRecord.id) {
        return res.status(403).json({
          message: 'You can only edit your direct subordinates',
        });
      }
      // Managers cannot change compensation or reporting structure
      delete value.salary;
      delete value.departmentId;
      delete value.managerId;
    }

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

// DELETE /employees/:id — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
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
