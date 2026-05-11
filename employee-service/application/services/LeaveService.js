const { Op }       = require('sequelize');
const Employee     = require('../../models/Employee');
const leaveRepo    = require('../../infrastructure/repositories/LeaveRepository');

const err = (msg, status) => Object.assign(new Error(msg), { status });

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function workingDaysCount(startDate, endDate) {
  let count = 0;
  const end    = parseDate(endDate);
  const cursor = parseDate(startDate);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Leave Service ─────────────────────────────────────────────────────────────

class LeaveService {

  // ── Helpers ────────────────────────────────────────────────────────────────

  workingDaysCount(startDate, endDate) {
    return workingDaysCount(startDate, endDate);
  }

  async getAvailableBalance(employeeId, leaveTypeId) {
    const breakdown = await leaveRepo.getLedgerBreakdown(employeeId, leaveTypeId);
    const reserved  = await leaveRepo.getReservedDays(employeeId, leaveTypeId);
    const ledgerNet = breakdown.accrued - breakdown.consumed;
    return Math.round((ledgerNet - reserved) * 100) / 100;
  }

  // ── Approve / reject authorization ────────────────────────────────────────

  async #checkApprovalAuth(request, currentEmployee, role) {
    const emp = request.employee || await Employee.findByPk(request.employeeId);
    if (!emp) throw err('Employee not found', 404);

    const managerId = emp.managerId;

    // The direct manager can always approve/reject
    if (currentEmployee && managerId === currentEmployee.id) return;

    // Admin can approve/reject only when the employee has no manager in the chain
    if (role === 'admin' && (!managerId || managerId === emp.id)) return;

    throw err('Insufficient permissions', 403);
  }

  // ── Submit leave request ───────────────────────────────────────────────────

  async createRequest(employee, { leaveTypeId, startDate, endDate, reason }, actorUserId) {
    const leaveType = await leaveRepo.findLeaveTypeById(leaveTypeId);
    if (!leaveType) throw err('Leave type not found', 404);

    // Joi string().isoDate() may expand 'YYYY-MM-DD' to full ISO string; normalize back
    startDate = String(startDate).slice(0, 10);
    endDate   = String(endDate).slice(0, 10);

    // --- Date validations ---
    if (endDate < startDate)
      throw err('end_date must be >= start_date', 400);
    if (new Date(startDate).getFullYear() !== new Date(endDate).getFullYear())
      throw err('start_date and end_date must be in the same calendar year', 400);

    const wdc = workingDaysCount(startDate, endDate);
    if (wdc === 0) throw err('Selected date range contains no working days (Mon–Fri)', 400);

    const today = todayStr();

    // --- Leave-type-specific rules ---
    if (leaveType.code === 'annual') {
      if (startDate < today)
        throw err('Annual leave cannot start in the past', 400);
    }
    if (leaveType.code === 'sick') {
      const maxDays = leaveType.maxRetroactiveDays || 0;
      const earliest = parseDate(today);
      earliest.setDate(earliest.getDate() - maxDays);
      const minStart = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, '0')}-${String(earliest.getDate()).padStart(2, '0')}`;
      if (startDate < minStart)
        throw err(`Sick leave cannot be submitted more than ${maxDays} days retroactively`, 400);
    }

    // --- Balance check ---
    const available = await this.getAvailableBalance(employee.id, leaveTypeId);
    if (available < wdc)
      throw err(`Insufficient leave balance. Available: ${available}, requested: ${wdc}`, 400);

    // --- Create request (model beforeCreate hook handles overlap check) ---
    let request;
    try {
      request = await leaveRepo.createRequest({
        employeeId:       employee.id,
        leaveTypeId,
        startDate,
        endDate,
        workingDaysCount: wdc,
        status:           'pending',
        reason:           reason || null,
        submittedAt:      new Date(),
      });
    } catch (e) {
      if (e.name === 'LeaveOverlapError')
        throw err('You already have an active leave request covering these dates', 409);
      if (e.name === 'SequelizeValidationError')
        throw err(e.errors[0].message, 400);
      throw e;
    }

    await leaveRepo.createAuditEntry({
      requestId:   request.id,
      eventType:   'created',
      actorUserId: String(actorUserId),
      payloadJson: { employeeId: employee.id, leaveTypeId, startDate, endDate, wdc },
    });

    return leaveRepo.findRequestById(request.id);
  }

  // ── List requests ──────────────────────────────────────────────────────────

  async listRequests({ currentEmployee, role, as, all, status, leaveTypeId, startDateFrom, startDateTo, page = 1, limit = 25 }) {
    const { Op } = require('sequelize');
    const where = {};

    if (all === 'true' || all === true) {
      if (role !== 'admin') throw err('Insufficient permissions', 403);
      // no employee filter — return everything
    } else if (as === 'manager') {
      if (!currentEmployee) throw err('No employee record linked to your account', 404);
      // direct reports
      const directReports = await Employee.findAll({ where: { managerId: currentEmployee.id } });
      const ids = directReports.map((e) => e.id);
      if (ids.length === 0) return { requests: [], total: 0, page, limit, totalPages: 0 };
      where.employeeId = { [Op.in]: ids };
    } else {
      // default: own requests
      if (!currentEmployee) throw err('No employee record linked to your account', 404);
      where.employeeId = currentEmployee.id;
    }

    if (status)        where.status      = status;
    if (leaveTypeId)   where.leaveTypeId = Number(leaveTypeId);
    if (startDateFrom) where.startDate   = { ...(where.startDate || {}), [Op.gte]: startDateFrom };
    if (startDateTo)   where.startDate   = { ...(where.startDate || {}), [Op.lte]: startDateTo };

    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await leaveRepo.findRequests({
      where,
      offset,
      limit: Number(limit),
    });

    return {
      requests:   rows,
      total:      count,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
    };
  }

  // ── Get single request (with access check) ────────────────────────────────

  async getRequest(id, currentEmployee, role) {
    const request = await leaveRepo.findRequestById(id);
    if (!request) throw err('Leave request not found', 404);

    if (role === 'admin') return request;
    if (!currentEmployee) throw err('Insufficient permissions', 403);
    if (request.employeeId === currentEmployee.id) return request;

    // manager of requester
    const emp = await Employee.findByPk(request.employeeId);
    if (emp && emp.managerId === currentEmployee.id) return request;

    throw err('Insufficient permissions', 403);
  }

  // ── Approve ────────────────────────────────────────────────────────────────

  async approve(id, currentEmployee, role, decisionNote, actorUserId) {
    const request = await leaveRepo.findRequestById(id);
    if (!request) throw err('Leave request not found', 404);
    if (request.status !== 'pending') throw err('Only pending requests can be approved', 400);

    await this.#checkApprovalAuth(request, currentEmployee, role);

    const updated = await leaveRepo.updateRequest(id, {
      status:          'approved',
      decidedAt:       new Date(),
      decidedByUserId: String(actorUserId),
      decisionNote:    decisionNote || null,
    });

    await leaveRepo.createAuditEntry({
      requestId:   id,
      eventType:   'approved',
      actorUserId: String(actorUserId),
      payloadJson: { decisionNote: decisionNote || null },
    });

    return updated;
  }

  // ── Reject ─────────────────────────────────────────────────────────────────

  async reject(id, currentEmployee, role, decisionNote, actorUserId) {
    if (!decisionNote || !String(decisionNote).trim())
      throw err('decision_note is required when rejecting a request', 400);

    const request = await leaveRepo.findRequestById(id);
    if (!request) throw err('Leave request not found', 404);
    if (!['pending', 'approved'].includes(request.status))
      throw err('Only pending or approved requests can be rejected', 400);

    await this.#checkApprovalAuth(request, currentEmployee, role);

    const updated = await leaveRepo.updateRequest(id, {
      status:          'rejected',
      decidedAt:       new Date(),
      decidedByUserId: String(actorUserId),
      decisionNote:    String(decisionNote).trim(),
    });

    await leaveRepo.createAuditEntry({
      requestId:   id,
      eventType:   'rejected',
      actorUserId: String(actorUserId),
      payloadJson: { decisionNote: String(decisionNote).trim() },
    });

    return updated;
  }

  // ── Withdraw ───────────────────────────────────────────────────────────────

  async withdraw(id, currentEmployee) {
    if (!currentEmployee) throw err('No employee record linked to your account', 404);

    const request = await leaveRepo.findRequestById(id);
    if (!request) throw err('Leave request not found', 404);
    if (request.employeeId !== currentEmployee.id)
      throw err('You can only withdraw your own requests', 403);
    if (!['pending', 'approved'].includes(request.status))
      throw err('Only pending or approved requests can be withdrawn', 400);

    const today = todayStr();
    if (request.startDate <= today)
      throw err('Cannot withdraw a request on or after its start date', 400);

    const updated = await leaveRepo.updateRequest(id, {
      status:      'withdrawn',
      withdrawnAt: new Date(),
    });

    await leaveRepo.createAuditEntry({
      requestId:   id,
      eventType:   'withdrawn',
      actorUserId: String(currentEmployee.id),
      payloadJson: { previousStatus: request.status },
    });

    return updated;
  }

  // ── Leave balance ──────────────────────────────────────────────────────────

  async getLeaveBalance(targetEmployeeId, currentEmployee, role) {
    // Auth: employee themselves, their manager, or admin
    if (role !== 'admin') {
      if (!currentEmployee) throw err('Insufficient permissions', 403);
      if (currentEmployee.id !== Number(targetEmployeeId)) {
        const target = await Employee.findByPk(targetEmployeeId);
        if (!target || target.managerId !== currentEmployee.id)
          throw err('Insufficient permissions', 403);
      }
    }

    const leaveTypes = await leaveRepo.findAllLeaveTypes();
    const result = [];

    for (const lt of leaveTypes) {
      const breakdown = await leaveRepo.getLedgerBreakdown(targetEmployeeId, lt.id);
      const reserved  = await leaveRepo.getReservedDays(targetEmployeeId, lt.id);
      const available = Math.round((breakdown.accrued - breakdown.consumed - reserved) * 100) / 100;
      const upcoming  = await leaveRepo.getUpcomingApproved(targetEmployeeId, lt.id);

      result.push({
        leave_type: { id: lt.id, code: lt.code, name: lt.name, is_paid: lt.isPaid },
        accrued:    Math.round(breakdown.accrued  * 100) / 100,
        consumed:   Math.round(breakdown.consumed * 100) / 100,
        reserved,
        available,
        upcoming_approved: upcoming.map((r) => ({
          request_id: r.id,
          start:      r.startDate,
          end:        r.endDate,
          days:       r.workingDaysCount,
        })),
      });
    }

    return result;
  }

  // ── Daily consumption job (idempotent) ────────────────────────────────────

  async processConsumptionEntries(asOf = todayStr()) {
    const requests = await leaveRepo.findApprovedForConsumption(asOf);
    let processed = 0;

    for (const request of requests) {
      const existing = await leaveRepo.findConsumptionEntry(request.id);
      if (existing) continue; // idempotency guard

      await leaveRepo.createLedgerEntry({
        employeeId:       request.employeeId,
        leaveTypeId:      request.leaveTypeId,
        entryType:        'consumption',
        days:             -request.workingDaysCount,
        reason:           'Leave consumed',
        relatedRequestId: request.id,
        effectiveDate:    request.startDate,
        createdByUserId:  'system',
      });

      await leaveRepo.createAuditEntry({
        requestId:   request.id,
        eventType:   'consumed',
        actorUserId: 'system',
        payloadJson: { days: -request.workingDaysCount },
      });

      processed++;
    }

    return processed;
  }

  // ── Yearly accrual job ────────────────────────────────────────────────────

  async processYearlyAccrual(asOf = new Date()) {
    const year  = asOf.getFullYear();
    const jan1  = `${year}-01-01`;
    const [annualType, sickType] = await Promise.all([
      leaveRepo.findLeaveTypeByCode('annual'),
      leaveRepo.findLeaveTypeByCode('sick'),
    ]);
    if (!annualType || !sickType) throw new Error('Leave types not seeded');

    const employees = await leaveRepo.findActiveEmployeesWithHireDate();
    let processed = 0;

    for (const emp of employees) {
      // years_with_employer = floor((Jan 1 of this year − hire_date).days / 365)
      const hireMs = new Date(emp.hireDate).getTime();
      const jan1Ms = new Date(jan1).getTime();
      const yearsWithEmployer = Math.floor((jan1Ms - hireMs) / (365 * 24 * 3600 * 1000));
      const annualDays = 20 + Math.floor(Math.max(0, yearsWithEmployer) / 5);

      await leaveRepo.createLedgerEntry({
        employeeId:      emp.id,
        leaveTypeId:     annualType.id,
        entryType:       'accrual',
        days:            annualDays,
        reason:          `Annual accrual ${year}`,
        effectiveDate:   jan1,
        createdByUserId: 'system',
      });

      await leaveRepo.createLedgerEntry({
        employeeId:      emp.id,
        leaveTypeId:     sickType.id,
        entryType:       'accrual',
        days:            20,
        reason:          `Sick leave accrual ${year}`,
        effectiveDate:   jan1,
        createdByUserId: 'system',
      });

      processed++;
    }

    return processed;
  }

  // ── Hire-time accrual (called after employee creation) ────────────────────

  async grantHireTimeAccrual(employee, actorUserId = 'system') {
    if (!employee.hireDate) return;

    const [annualType, sickType] = await Promise.all([
      leaveRepo.findLeaveTypeByCode('annual'),
      leaveRepo.findLeaveTypeByCode('sick'),
    ]);
    if (!annualType || !sickType) return; // leave types not seeded yet

    const hireDate = employee.hireDate; // 'YYYY-MM-DD'
    const year     = hireDate.slice(0, 4);
    const jan1     = `${year}-01-01`;
    const dec31    = `${year}-12-31`;

    const totalWorkingDays     = workingDaysCount(jan1,     dec31);
    const remainingWorkingDays = workingDaysCount(hireDate, dec31);
    const proratedAnnual       = Math.floor(20 * remainingWorkingDays / totalWorkingDays);

    await leaveRepo.createLedgerEntry({
      employeeId:      employee.id,
      leaveTypeId:     annualType.id,
      entryType:       'accrual',
      days:            proratedAnnual,
      reason:          'Pro-rated annual leave on hire',
      effectiveDate:   hireDate,
      createdByUserId: String(actorUserId),
    });

    await leaveRepo.createLedgerEntry({
      employeeId:      employee.id,
      leaveTypeId:     sickType.id,
      entryType:       'accrual',
      days:            20,
      reason:          'Sick leave grant on hire',
      effectiveDate:   hireDate,
      createdByUserId: String(actorUserId),
    });
  }
}

module.exports = new LeaveService();
