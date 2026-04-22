const express    = require('express');
const Joi        = require('joi');
const Employee   = require('../models/Employee');
const Department = require('../models/Department');
const cache      = require('../cache');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const BASE = process.env.GATEWAY_URL || 'http://localhost:8080';
const CACHE_KEY = 'employees:all';

const employeeLinks = (e) => ({
  self:       { href: `${BASE}/api/v1/employees/${e.id}`, method: 'GET'    },
  update:     { href: `${BASE}/api/v1/employees/${e.id}`, method: 'PUT'    },
  delete:     { href: `${BASE}/api/v1/employees/${e.id}`, method: 'DELETE' },
  collection: { href: `${BASE}/api/v1/employees`,         method: 'GET'    },
});

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

// GET /employees
router.get('/', async (req, res) => {
  try {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return res.json(cached);

    const employees = await Employee.findAll({
      include: includeAssociations,
      order: [['createdAt', 'DESC']],
    });
    const body = {
      status: 'ok',
      employees: employees.map((e) => ({ ...e.toJSON(), _links: employeeLinks(e) })),
    };
    await cache.set(CACHE_KEY, body, 30);
    res.json(body);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /employees/me
router.get('/me', async (req, res) => {
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) return res.status(401).json({ message: 'Authentication required' });

  try {
    const employee = await Employee.findOne({
      where: { email: userEmail },
      include: [
        ...includeAssociations,
        {
          model:      Employee,
          as:         'subordinates',
          attributes: ['id', 'firstName', 'lastName', 'position', 'status'],
          include:    [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
        },
      ],
    });
    if (!employee) return res.status(404).json({ message: 'No employee record linked to your account' });
    res.json({ ...employee.toJSON(), _links: employeeLinks(employee) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /employees/me
router.put('/me', async (req, res) => {
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) return res.status(401).json({ message: 'Authentication required' });

  const { phone } = req.body;

  try {
    const employee = await Employee.findOne({ where: { email: userEmail } });
    if (!employee) return res.status(404).json({ message: 'No employee record linked to your account' });

    await employee.update({ phone: phone ?? employee.phone });
    await cache.del(CACHE_KEY);
    const full = await Employee.findByPk(employee.id, { include: includeAssociations });
    res.json({ ...full.toJSON(), _links: employeeLinks(full) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /employees/:id
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, { include: includeAssociations });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ ...employee.toJSON(), _links: employeeLinks(employee) });
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
    await cache.del(CACHE_KEY);
    const full = await Employee.findByPk(employee.id, { include: includeAssociations });
    res.status(201).json({ ...full.toJSON(), _links: employeeLinks(full) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /employees/:id
router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const role      = req.headers['x-user-role'];
  const userEmail = req.headers['x-user-email'];

  const { error, value } = employeeUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (role === 'manager') {
      const managerRecord = await Employee.findOne({ where: { email: userEmail } });
      if (!managerRecord) {
        return res.status(403).json({ message: 'Your account is not linked to an employee record' });
      }
      if (employee.managerId !== managerRecord.id) {
        return res.status(403).json({ message: 'You can only edit your direct subordinates' });
      }
      delete value.salary;
      delete value.departmentId;
      delete value.managerId;
    }

    await employee.update(value);
    await cache.del(CACHE_KEY);
    const full = await Employee.findByPk(employee.id, { include: includeAssociations });
    res.json({ ...full.toJSON(), _links: employeeLinks(full) });
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
    await cache.del(CACHE_KEY);
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
