const express           = require('express');
const Joi               = require('joi');
const cache             = require('../cache');
const { requireRole }   = require('../middleware/auth');
const departmentService = require('../application/services/DepartmentService');

const router = express.Router();
const BASE   = process.env.GATEWAY_URL || 'http://localhost:8080';

const deptLinks = (d) => ({
  self:       { href: `${BASE}/api/v1/departments/${d.id}`, method: 'GET'    },
  delete:     { href: `${BASE}/api/v1/departments/${d.id}`, method: 'DELETE' },
  collection: { href: `${BASE}/api/v1/departments`,         method: 'GET'    },
});

const departmentSchema = Joi.object({
  name: Joi.string().trim().required(),
});

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (!res.headersSent) res.json(result);
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// ── GET /departments — paginated + filtered list ─────────────────────────────

router.get('/', handle(async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;

  const isDefaultQuery = !search && String(page) === '1';
  const cacheKey = `departments:page:${page}:limit:${limit}`;

  if (isDefaultQuery) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const result = await departmentService.listDepartments({
    page: Number(page), limit: Number(limit), search,
  });

  const body = {
    status:      'ok',
    departments: result.departments.map((d) => ({
      ...d,
      _links: deptLinks(d),
    })),
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

// ── GET /departments/:id ─────────────────────────────────────────────────────

router.get('/:id', handle(async (req) => {
  const dept = await departmentService.getDepartment(req.params.id);
  return { ...dept.toJSON(), _links: deptLinks(dept) };
}));

// ── POST /departments — admin only ───────────────────────────────────────────

router.post('/', requireRole('admin'), handle(async (req, res) => {
  const { error, value } = departmentSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const dept = await departmentService.createDepartment(value);
    await cache.del(`departments:page:1:limit:50`);
    res.status(201).json({ ...dept.toJSON(), _links: deptLinks(dept) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Department already exists' });
    }
    throw err;
  }
}));

// ── DELETE /departments/:id — admin only ─────────────────────────────────────

router.delete('/:id', requireRole('admin'), handle(async (req) => {
  const result = await departmentService.deleteDepartment(req.params.id);
  await cache.del(`departments:page:1:limit:50`);
  return result;
}));

module.exports = router;
