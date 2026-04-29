const express    = require('express');
const morgan     = require('morgan');
const { connectDB, sequelize } = require('./config/database');
const Department = require('./models/Department');
const Employee   = require('./models/Employee');
const employeeRoutes   = require('./routes/employee');
const departmentRoutes = require('./routes/department');
const { startConsumer }         = require('./consumer');
const { startGrpcServer }       = require('./grpc/server');
const { register, startHeartbeat } = require('./registerService');
const logger     = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Associations — onDelete: 'SET NULL' so removing a dept/manager nullifies FKs rather than erroring
Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',    onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',          onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',       onDelete: 'SET NULL', hooks: true });

app.use('/employees', employeeRoutes);
app.use('/departments', departmentRoutes);

app.get('/',       (_req, res) => res.send('Employee Service Online'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'employee-service' }));

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  logger.info('Tables synced');
  app.listen(PORT, async () => {
    logger.info(`Employee Service running on http://localhost:${PORT}`);
    await register();
    startHeartbeat();
  });
  startConsumer();  // RabbitMQ consumer — non-blocking, retries internally
  startGrpcServer(); // gRPC server on port 50051
};

startServer();
