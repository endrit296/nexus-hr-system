const express              = require('express');
const Joi                  = require('joi');
const { resolveEmployee }  = require('../middleware/resolveEmployee');
const leaveService         = require('../application/services/LeaveService');

const router = express.Router();

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (!res.headersSent) res.json(result);
  } catch (e) {
    if (!res.headersSent) res.status(e.status || 500).json({ message: e.message || 'Server error' });
  }
};

// ── POST /leave-requests ──────────────────────────────────────────────────────

const createSchema = Joi.object({
  leaveTypeId: Joi.number().integer().positive().required(),
  startDate:   Joi.string().isoDate().required(),
  endDate:     Joi.string().isoDate().required(),
  reason:      Joi.string().trim().allow('', null),
});

router.post('/', resolveEmployee, handle(async (req, res) => {
  if (!req.employee) return res.status(404).json({ message: 'No employee record linked to your account' });

  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const actorUserId = req.headers['x-user-id'] || 'unknown';
  const request = await leaveService.createRequest(req.employee, value, actorUserId);
  res.status(201).json(request);
}));

// ── GET /leave-requests ───────────────────────────────────────────────────────

router.get('/', resolveEmployee, handle(async (req) => {
  const { as, all, status, leaveTypeId, startDateFrom, startDateTo, page, limit } = req.query;
  const role = req.headers['x-user-role'];

  return leaveService.listRequests({
    currentEmployee: req.employee,
    role,
    as, all, status, leaveTypeId, startDateFrom, startDateTo,
    page:  Number(page  || 1),
    limit: Number(limit || 25),
  });
}));

// ── GET /leave-requests/:id ───────────────────────────────────────────────────

router.get('/:id', resolveEmployee, handle(async (req) => {
  const role = req.headers['x-user-role'];
  return leaveService.getRequest(req.params.id, req.employee, role);
}));

// ── POST /leave-requests/:id/approve ─────────────────────────────────────────

router.post('/:id/approve', resolveEmployee, handle(async (req, res) => {
  const role        = req.headers['x-user-role'];
  const actorUserId = req.headers['x-user-id'] || 'unknown';

  if (!req.headers['x-user-role']) return res.status(401).json({ message: 'Authentication required' });

  const { decisionNote } = req.body;
  return leaveService.approve(req.params.id, req.employee, role, decisionNote, actorUserId);
}));

// ── POST /leave-requests/:id/reject ──────────────────────────────────────────

router.post('/:id/reject', resolveEmployee, handle(async (req, res) => {
  const role        = req.headers['x-user-role'];
  const actorUserId = req.headers['x-user-id'] || 'unknown';

  if (!req.headers['x-user-role']) return res.status(401).json({ message: 'Authentication required' });

  const { decisionNote } = req.body;
  return leaveService.reject(req.params.id, req.employee, role, decisionNote, actorUserId);
}));

// ── POST /leave-requests/:id/withdraw ────────────────────────────────────────

router.post('/:id/withdraw', resolveEmployee, handle(async (req, res) => {
  if (!req.employee) return res.status(404).json({ message: 'No employee record linked to your account' });
  return leaveService.withdraw(req.params.id, req.employee);
}));

module.exports = router;
