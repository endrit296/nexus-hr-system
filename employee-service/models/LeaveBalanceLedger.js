const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LeaveBalanceLedger = sequelize.define('LeaveBalanceLedger', {
  employeeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  leaveTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  entryType: {
    type: DataTypes.ENUM('accrual', 'consumption', 'adjustment'),
    allowNull: false,
  },
  // Signed decimal: positive = credit, negative = debit. Must not be 0.
  days: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      notZero(value) {
        if (parseFloat(value) === 0) {
          throw new Error('days must not be 0');
        }
      },
    },
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  relatedRequestId: {
    // FK to LeaveRequest — nullable (accrual/adjustment entries have no request)
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  effectiveDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  createdByUserId: {
    // Soft reference to MongoDB User._id — no cross-DB FK possible
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'leave_balance_ledger',
  underscored: true,
  timestamps: true,
  updatedAt: false, // ledger entries are immutable
});

module.exports = LeaveBalanceLedger;
