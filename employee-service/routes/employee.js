const express         = require('express');
const Joi             = require('joi');
const cache           = require('../cache');
const { requireRole } = require('../middleware/auth');
const employeeService = require('../application/services/EmployeeService');

const router   = express.Router();
const BASE     = process.env.GATEWAY_URL || 'http://localhost:8080';

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

const attachLinks = (e) => ({ ...e.toJSON(), _links: employeeLinks(e) });

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (!res.headersSent) res.json(result);
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// ── GET /employees — paginated + filtered list ───────────────────────────────

router.get('/', handle(async (req, res) => {
  const { page = 1, limit = 20, status, departmentId, managerId, search } = req.query;

  // Cache only first page with no filters to keep behaviour safe
  const isDefaultQuery = !status && !departmentId && !managerId && !search && String(page) === '1';
  const cacheKey = `employees:page:${page}:limit:${limit}`;

  if (isDefaultQuery) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const result = await employeeService.listEmployees({
    page: Number(page), limit: Number(limit), status, departmentId, managerId, search,
  });

  const body = {
    status:     'ok',
    employees:  result.employees.map(attachLinks),
    pagination: {
      page:       result.page,
      limit:      result.limit,
      total:      result.total,
      totalPages: result.totalPages,
    },
  };

  if (isDefaultQuery) await cache.set(cacheKey, body, 30);
  return body;
}));

// ── GET /employees/me ────────────────────────────────────────────────────────

router.get('/me', handle(async (req) => {
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) throw Object.assign(new Error('Authentication required'), { status: 401 });
  const employee = await employeeService.getEmployeeByEmail(userEmail);
  return attachLinks(employee);
}));

// ── PUT /employees/me ────────────────────────────────────────────────────────

router.put('/me', handle(async (req) => {
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) throw Object.assign(new Error('Authentication required'), { status: 401 });

  const employee = await employeeService.getEmployeeByEmail(userEmail);
  const updated  = await employeeService.updateEmployee(employee.id, { phone: req.body.phone ?? employee.phone });
  await cache.del(`employees:page:1:limit:20`);
  return attachLinks(updated);
}));

// ── GET /employees/:id ───────────────────────────────────────────────────────

router.get('/:id', handle(async (req) => {
  const employee = await employeeService.getEmployee(req.params.id);
  return attachLinks(employee);
}));

// ── POST /employees — admin only ─────────────────────────────────────────────

router.post('/', requireRole('admin'), handle(async (req, res) => {
  const { error, value } = employeeSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const employee = await employeeService.createEmployee(value);
    await cache.del(`employees:page:1:limit:20`);
    res.status(201).json(attachLinks(employee));
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    throw err;
  }
}));

// ── PUT /employees/:id ───────────────────────────────────────────────────────

router.put('/:id', requireRole('admin', 'manager'), handle(async (req, res) => {
  const role      = req.headers['x-user-role'];
  const userEmail = req.headers['x-user-email'];

  const { error, value } = employeeUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  if (role === 'manager') {
    const managerRecord = await employeeService.getEmployeeByEmail(userEmail).catch(() => null);
    if (!managerRecord) {
      return res.status(403).json({ message: 'Your account is not linked to an employee record' });
    }
    const target = await employeeService.getEmployee(req.params.id);
    if (target.managerId !== managerRecord.id) {
      return res.status(403).json({ message: 'You can only edit your direct subordinates' });
    }
    delete value.salary;
    delete value.departmentId;
    delete value.managerId;
  }

  try {
    const updated = await employeeService.updateEmployee(req.params.id, value);
    await cache.del(`employees:page:1:limit:20`);
    res.json(attachLinks(updated));
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    throw err;
  }
}));

// ── DELETE /employees/:id — admin only ───────────────────────────────────────

router.delete('/:id', requireRole('admin'), handle(async (req) => {
  const result = await employeeService.deleteEmployee(req.params.id);
  await cache.del(`employees:page:1:limit:20`);
  return result;
}));

module.exports = router;
