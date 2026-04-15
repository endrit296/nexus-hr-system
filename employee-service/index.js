const express = require('express');
const { connectDB, sequelize } = require('./config/database');
const Department = require('./models/Department');
const Employee = require('./models/Employee');
const employeeRoutes = require('./routes/employee');
const departmentRoutes = require('./routes/department');

const app = express();
const PORT = 3002;

app.use(express.json());

// Associations
Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager' });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates' });

app.use('/employees', employeeRoutes);
app.use('/departments', departmentRoutes);

app.get('/', (req, res) => res.send('Employee Service Online'));

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  console.log('Tables synced');
  app.listen(PORT, () => console.log(`Employee Service running on http://localhost:${PORT}`));
};

startServer();
