const { Op }             = require('sequelize');
const LeaveType          = require('../../models/LeaveType');
const LeaveRequest       = require('../../models/LeaveRequest');
const LeaveBalanceLedger = require('../../models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('../../models/LeaveRequestAudit');
const Employee           = require('../../models/Employee');

const likeOp = process.env.NODE_ENV === 'test' ? Op.like : Op.iLike;

class LeaveRepository {
  // ── Leave types ──────────────────────────────────────────────────────────────

  async findAllLeaveTypes() {
    return LeaveType.findAll({ order: [['code', 'ASC']] });
  }

  async findLeaveTypeById(id) {
    return LeaveType.findByPk(id);
  }

  async findLeaveTypeByCode(code) {
    return LeaveType.findOne({ where: { code } });
  }

  // ── Leave requests ───────────────────────────────────────────────────────────

  async createRequest(data) {
    return LeaveRequest.create(data);
  }

  async findRequestById(id) {
    return LeaveRequest.findByPk(id, {
      include: [
        { model: LeaveType, as: 'leaveType' },
        { model: Employee,  as: 'employee', attributes: ['id', 'firstName', 'lastName', 'email', 'managerId'] },
      ],
    });
  }

  async findRequests({ where = {}, order = [['submittedAt', 'DESC']], offset = 0, limit = 25 }) {
    return LeaveRequest.findAndCountAll({
      where,
      include: [
        { model: LeaveType, as: 'leaveType' },
        { model: Employee,  as: 'employee', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order,
      offset,
      limit,
      distinct: true,
    });
  }

  async updateRequest(id, data) {
    const req = await LeaveRequest.findByPk(id);
    if (!req) return null;
    await req.update(data);
    return this.findRequestById(id);
  }

  // ── Audit ────────────────────────────────────────────────────────────────────

  async createAuditEntry({ requestId, eventType, actorUserId, payloadJson }) {
    return LeaveRequestAudit.create({ requestId, eventType, actorUserId, payloadJson });
  }

  // ── Ledger ───────────────────────────────────────────────────────────────────

  async createLedgerEntry(data) {
    return LeaveBalanceLedger.create(data);
  }

  async getLedgerSumByType(employeeId) {
    const rows = await LeaveBalanceLedger.findAll({
      where: { employeeId },
      attributes: ['leaveTypeId', 'days'],
    });
    const sums = {};
    for (const r of rows) {
      const tid = r.leaveTypeId;
      sums[tid] = (sums[tid] || 0) + parseFloat(r.days);
    }
    return sums; // { [leaveTypeId]: net }
  }

  async getLedgerBreakdown(employeeId, leaveTypeId) {
    const rows = await LeaveBalanceLedger.findAll({
      where: { employeeId, leaveTypeId },
      attributes: ['entryType', 'days'],
    });
    let accrued = 0, consumed = 0;
    for (const r of rows) {
      const d = parseFloat(r.days);
      if (r.entryType === 'accrual')     accrued  += d;
      if (r.entryType === 'consumption') consumed += Math.abs(d);
    }
    return { accrued, consumed };
  }

  async findConsumptionEntry(requestId) {
    return LeaveBalanceLedger.findOne({
      where: { relatedRequestId: requestId, entryType: 'consumption' },
    });
  }

  // ── Active (pending/approved) requests without a consumption entry ────────────

  async getReservedDays(employeeId, leaveTypeId) {
    const active = await LeaveRequest.findAll({
      where: {
        employeeId,
        leaveTypeId,
        status: { [Op.in]: ['pending', 'approved'] },
      },
    });
    let reserved = 0;
    for (const r of active) {
      const consumed = await this.findConsumptionEntry(r.id);
      if (!consumed) reserved += r.workingDaysCount;
    }
    return reserved;
  }

  async getUpcomingApproved(employeeId, leaveTypeId) {
    const today = new Date().toISOString().slice(0, 10);
    return LeaveRequest.findAll({
      where: {
        employeeId,
        leaveTypeId,
        status: 'approved',
        startDate: { [Op.gt]: today },
      },
      order: [['startDate', 'ASC']],
    });
  }

  // ── For daily consumption job ─────────────────────────────────────────────────

  async findApprovedForConsumption(asOfDate) {
    return LeaveRequest.findAll({
      where: {
        status: 'approved',
        startDate: { [Op.lte]: asOfDate },
      },
    });
  }

  // ── For yearly accrual job ────────────────────────────────────────────────────

  async findActiveEmployeesWithHireDate() {
    return Employee.findAll({
      where: {
        status: 'active',
        hireDate: { [Op.ne]: null },
      },
    });
  }
}

module.exports = new LeaveRepository();
