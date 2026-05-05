const Joi            = require('joi');
const TimeLog        = require('../models/TimeLog');
const employeeClient = require('../grpc/employeeClient');

// ── Shared helpers ────────────────────────────────────────────────────────────

const clockIdSchema = Joi.object({
    employeeId: Joi.number().integer().positive().required(),
});

// Resolve and optionally validate ownership of an employee record.
// - For 'employee' role: fetches via gRPC and compares email with x-user-email.
//   Returns { employee } on success, or sends 403/404 and returns null.
// - For admin/manager: fetches via gRPC for name snapshot only.
//   Returns { employee } on success, or sends 404 and returns null.
const resolveEmployee = async (req, res, employeeId) => {
    const role      = req.headers['x-user-role'];
    const userEmail = req.headers['x-user-email'];

    let employee;
    try {
        employee = await employeeClient.getEmployee(employeeId);
    } catch {
        res.status(404).json({ message: 'Employee not found' });
        return null;
    }

    if (role === 'employee') {
        if (!employee.email || employee.email !== userEmail) {
            res.status(403).json({ message: 'You can only manage your own time logs' });
            return null;
        }
    }

    return employee;
};

// ── POST /api/payroll/time/clock-in ──────────────────────────────────────────

exports.clockIn = async (req, res) => {
    try {
        const { error, value } = clockIdSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { employeeId } = value;

        const employee = await resolveEmployee(req, res, employeeId);
        if (!employee) return;

        const existing = await TimeLog.findOne({ employeeId, status: 'Active' });
        if (existing) return res.status(409).json({ message: 'Employee already clocked in' });

        const log = await TimeLog.create({
            employeeId,
            employeeNameSnapshot: `${employee.firstName} ${employee.lastName}`,
            checkIn: new Date(),
            status:  'Active',
        });

        res.status(201).json(log);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── POST /api/payroll/time/clock-out ─────────────────────────────────────────

exports.clockOut = async (req, res) => {
    try {
        const { error, value } = clockIdSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { employeeId } = value;

        const employee = await resolveEmployee(req, res, employeeId);
        if (!employee) return;

        const log = await TimeLog.findOne({ employeeId, status: 'Active' });
        if (!log) return res.status(404).json({ message: 'No active clock-in found for this employee' });

        const checkOut   = new Date();
        log.checkOut     = checkOut;
        log.hoursWorked  = +((checkOut - log.checkIn) / 3600000).toFixed(2);
        log.status       = 'Completed';
        await log.save();

        res.status(200).json(log);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /api/payroll/time/my ──────────────────────────────────────────────────

exports.getMyTimeLogs = async (req, res) => {
    try {
        const { error, value } = Joi.object({
            employeeId: Joi.number().integer().positive().required(),
        }).validate({ employeeId: req.query.employeeId });
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { employeeId } = value;

        const employee = await resolveEmployee(req, res, employeeId);
        if (!employee) return;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const timelogs = await TimeLog.find({
            employeeId,
            checkIn: { $gte: thirtyDaysAgo },
        }).sort({ checkIn: -1 });

        const totalHours = +timelogs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0).toFixed(2);

        res.status(200).json({ timelogs, totalHours });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /api/payroll/time/employee/:employeeId ────────────────────────────────
// Admin/manager only — enforced at the route level via requireRole.

exports.getEmployeeTimeLogs = async (req, res) => {
    try {
        const employeeId = parseInt(req.params.employeeId, 10);
        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({ message: 'employeeId must be a positive integer' });
        }

        const page  = Math.max(1, parseInt(req.query.page  || 1,  10));
        const limit = Math.max(1, parseInt(req.query.limit || 20, 10));

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const filter = { employeeId, checkIn: { $gte: thirtyDaysAgo } };

        const [timelogs, total] = await Promise.all([
            TimeLog.find(filter).sort({ checkIn: -1 }).skip((page - 1) * limit).limit(limit),
            TimeLog.countDocuments(filter),
        ]);

        res.status(200).json({
            timelogs,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── POST /api/payroll/calculate ───────────────────────────────────────────────

exports.processSalary = async (req, res) => {
    try {
        const { employeeName, role, hourlyRate, hoursWorked } = req.body;

        if (!employeeName || typeof employeeName !== 'string' || !employeeName.trim()) {
            return res.status(400).json({ status: 'Error', message: 'employeeName is required' });
        }
        const rate  = parseFloat(hourlyRate);
        const hours = parseFloat(hoursWorked);
        if (!isFinite(rate)  || rate  <= 0) return res.status(400).json({ status: 'Error', message: 'hourlyRate must be a positive number' });
        if (!isFinite(hours) || hours <= 0) return res.status(400).json({ status: 'Error', message: 'hoursWorked must be a positive number' });

        const grossSalary = rate * hours;
        const taxAmount   = grossSalary * 0.10;
        const netSalary   = grossSalary - taxAmount;

        res.status(200).json({
            header: {
                company:     'NEXUS HR SOLUTIONS',
                report_type: 'Monthly Payroll Statement',
                date:        new Date().toLocaleDateString(),
            },
            employee_profile: {
                full_name: employeeName,
                position:  role || 'Staff Member',
            },
            financial_summary: {
                hours_logged:     hours + ' hrs',
                rate_per_hour:    rate + ' €',
                gross_total:      grossSalary.toFixed(2) + ' €',
                deductions:       taxAmount.toFixed(2) + ' € (Tax 10%)',
                final_net_salary: netSalary.toFixed(2) + ' €',
            },
            status: 'VERIFIED',
        });
    } catch (error) {
        res.status(500).json({ status: 'Error', message: error.message });
    }
};

// ── GET /api/payroll/employee/:id ─────────────────────────────────────────────

exports.getEmployeePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const { hourlyRate, hoursWorked } = req.query;

        let employee;
        try {
            employee = await employeeClient.getEmployee(id);
        } catch {
            return res.status(404).json({ status: 'Error', message: 'Employee not found via gRPC' });
        }

        const rate  = parseFloat(hourlyRate  || 0);
        const hours = parseFloat(hoursWorked || 160);

        if (!isFinite(rate) || rate <= 0) {
            return res.status(400).json({ status: 'Error', message: 'hourlyRate must be a positive number' });
        }

        const grossSalary = rate * hours;
        const taxAmount   = grossSalary * 0.10;
        const netSalary   = grossSalary - taxAmount;

        res.status(200).json({
            header: {
                company:     'NEXUS HR SOLUTIONS',
                report_type: 'Monthly Payroll Statement',
                date:        new Date().toLocaleDateString(),
            },
            employee_profile: {
                full_name:   `${employee.firstName} ${employee.lastName}`,
                position:    employee.position || 'Staff Member',
                employee_id: employee.id,
            },
            financial_summary: {
                hours_logged:     hours + ' hrs',
                rate_per_hour:    rate + ' €',
                gross_total:      grossSalary.toFixed(2) + ' €',
                deductions:       taxAmount.toFixed(2) + ' € (Tax 10%)',
                final_net_salary: netSalary.toFixed(2) + ' €',
            },
            status: 'VERIFIED',
        });
    } catch (error) {
        res.status(500).json({ status: 'Error', message: error.message });
    }
};
