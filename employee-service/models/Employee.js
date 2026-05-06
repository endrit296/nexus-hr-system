const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Employee = sequelize.define('Employee', {
  firstName:    { type: DataTypes.STRING,                                   allowNull: false },
  lastName:     { type: DataTypes.STRING,                                   allowNull: false },
  email:        { type: DataTypes.STRING,                                   allowNull: false, unique: true },
  phone:        { type: DataTypes.STRING },
  position:     { type: DataTypes.STRING },
  status:       { type: DataTypes.ENUM('active', 'inactive', 'on_leave'), defaultValue: 'active' },
  hireDate:     { type: DataTypes.DATEONLY },
  hourlyRate:   { type: DataTypes.DECIMAL(10, 2) },
  salary:       { type: DataTypes.DECIMAL(10, 2) },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  managerId:    { type: DataTypes.INTEGER, allowNull: true },
  deletedAt:    { type: DataTypes.DATE,    allowNull: true },
}, {
  paranoid: true,
  indexes: [
    { fields: ['departmentId'] },
    { fields: ['managerId'] },
    { fields: ['status'] },
    { fields: ['hireDate'] },
    { fields: ['lastName', 'firstName'] },
  ],
});

module.exports = Employee;
