const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LeaveType = sequelize.define('LeaveType', {
  code: {
    type: DataTypes.ENUM('annual', 'sick'),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  requiresProofAfterDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  maxRetroactiveDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'leave_types',
  underscored: true,
});

module.exports = LeaveType;
