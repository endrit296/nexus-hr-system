const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LeaveRequestAudit = sequelize.define('LeaveRequestAudit', {
  requestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  eventType: {
    type: DataTypes.ENUM('created', 'approved', 'rejected', 'withdrawn', 'consumed'),
    allowNull: false,
  },
  actorUserId: {
    // Soft reference to MongoDB User._id — no cross-DB FK possible
    type: DataTypes.STRING,
    allowNull: false,
  },
  payloadJson: {
    // Snapshot of relevant state at the time of the event.
    // Sequelize maps DataTypes.JSON to JSONB in Postgres, TEXT in SQLite.
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'leave_request_audit',
  underscored: true,
  timestamps: true,
  updatedAt: false, // audit entries are immutable
});

module.exports = LeaveRequestAudit;
