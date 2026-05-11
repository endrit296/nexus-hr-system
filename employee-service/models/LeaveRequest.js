const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const ACTIVE_STATUSES = ['pending', 'approved'];

const LeaveRequest = sequelize.define('LeaveRequest', {
  employeeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  leaveTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isAfterOrEqualStart(value) {
        if (value < this.startDate) {
          throw new Error('end_date must be >= start_date');
        }
      },
      isSameYear(value) {
        if (
          new Date(value).getFullYear() !==
          new Date(this.startDate).getFullYear()
        ) {
          throw new Error('start_date and end_date must be in the same calendar year');
        }
      },
    },
  },
  workingDaysCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: { args: [1], msg: 'working_days_count must be > 0' },
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'withdrawn'),
    allowNull: false,
    defaultValue: 'pending',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  decidedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  decidedByUserId: {
    // Soft reference to MongoDB User._id — no cross-DB FK possible
    type: DataTypes.STRING,
    allowNull: true,
  },
  decisionNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  withdrawnAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'leave_requests',
  underscored: true,
});

// An employee cannot have two active (pending/approved) requests with overlapping dates.
// Implemented as a beforeCreate hook because Postgres range exclusion constraints
// require the btree_gist extension which is not guaranteed in this environment.
LeaveRequest.addHook('beforeCreate', async (req) => {
  const conflict = await LeaveRequest.findOne({
    where: {
      employeeId: req.employeeId,
      status: { [Op.in]: ACTIVE_STATUSES },
      startDate: { [Op.lte]: req.endDate },
      endDate:   { [Op.gte]: req.startDate },
    },
  });
  if (conflict) {
    const err = new Error(
      'Overlapping active leave request exists for this employee'
    );
    err.name = 'LeaveOverlapError';
    throw err;
  }
});

module.exports = LeaveRequest;
