const express    = require('express');
const Joi        = require('joi');
const Department = require('../models/Department');
const Employee   = require('../models/Employee');
const cache      = require('../cache');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const BASE = process.env.GATEWAY_URL || 'http://localhost:8080';
const CACHE_KEY = 'departments:all';

const deptLinks = (d) => ({
  self:       { href: `${BASE}/api/v1/departments/${d.id}`, method: 'GET'    },
  delete:     { href: `${BASE}/api/v1/departments/${d.id}`, method: 'DELETE' },
  collection: { href: `${BASE}/api/v1/departments`,         method: 'GET'    },
});

const departmentSchema = Joi.object({
  name: Joi.string().trim().required(),
});

// GET /departments
router.get('/', async (req, res) => {
  try {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return res.json(cached);

    const departments = await Department.findAll({ order: [['name', 'ASC']] });
    const employees   = await Employee.findAll({ attributes: ['departmentId'] });

    const countMap = {};
    employees.forEach((e) => {
      if (e.departmentId) countMap[e.departmentId] = (countMap[e.departmentId] || 0) + 1;
    });

    const body = {
      status: 'ok',
      departments: departments.map((d) => ({
        ...d.toJSON(),
        employeeCount: countMap[d.id] || 0,
        _links: deptLinks(d),
      })),
    };
    await cache.set(CACHE_KEY, body, 30);
    res.json(body);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /departments — admin only
router.post('/', requireRole('admin'), async (req, res) => {
  const { error, value } = departmentSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const dept = await Department.create(value);
    await cache.del(CACHE_KEY);
    res.status(201).json({ ...dept.toJSON(), _links: deptLinks(dept) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /departments/:id — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    const count = await Employee.count({ where: { departmentId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${count} employee(s) still assigned to this department`,
      });
    }

    await dept.destroy();
    await cache.del(CACHE_KEY);
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
