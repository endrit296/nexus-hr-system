const express        = require('express');
const router         = express.Router();
const timeController = require('../controllers/time.controller');
const { requireRole } = require('../middleware/auth');

// ── Payroll calculation (admin/manager only) ──────────────────────────────────
router.post('/calculate',     requireRole('admin', 'manager'), timeController.processSalary);
router.get('/employee/:id',   requireRole('admin', 'manager'), timeController.getEmployeePayroll);

// ── Time tracking — clock-in/out (self or admin/manager for any employee) ─────
router.post('/time/clock-in',  timeController.clockIn);
router.post('/time/clock-out', timeController.clockOut);

// ── Time log queries ──────────────────────────────────────────────────────────
router.get('/time/my',                                               timeController.getMyTimeLogs);
router.get('/time/employee/:employeeId', requireRole('admin', 'manager'), timeController.getEmployeeTimeLogs);

module.exports = router;
