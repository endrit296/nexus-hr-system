const express    = require('express');
const helmet     = require('helmet');
const morgan     = require('morgan');
const { connectDB, sequelize } = require('./config/database');
const Department        = require('./models/Department');
const Employee          = require('./models/Employee');
const LeaveType         = require('./models/LeaveType');
const LeaveRequest      = require('./models/LeaveRequest');
const LeaveBalanceLedger = require('./models/LeaveBalanceLedger');
const LeaveRequestAudit  = require('./models/LeaveRequestAudit');
const { seedLeaveTypes } = require('./seeds/leaveTypes');
const employeeRoutes   = require('./routes/employee');
const departmentRoutes = require('./routes/department');
const leaveRoutes      = require('./routes/leave');
const { startLeaveJobs } = require('./jobs/leaveJobs');
const { startConsumer }         = require('./consumer');
const { startGrpcServer }       = require('./grpc/server');
const { register, startHeartbeat } = require('./registerService');
const logger     = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Associations — onDelete: 'SET NULL' so removing a dept/manager nullifies FKs rather than erroring
Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees',    onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL', hooks: true });
Employee.belongsTo(Employee, { foreignKey: 'managerId', as: 'manager',          onDelete: 'SET NULL', hooks: true });
Employee.hasMany(Employee, { foreignKey: 'managerId', as: 'subordinates',       onDelete: 'SET NULL', hooks: true });

// Leave associations
Employee.hasMany(LeaveRequest,       { foreignKey: 'employeeId',      as: 'leaveRequests'  });
LeaveRequest.belongsTo(Employee,     { foreignKey: 'employeeId',      as: 'employee'       });
LeaveType.hasMany(LeaveRequest,      { foreignKey: 'leaveTypeId',     as: 'requests'       });
LeaveRequest.belongsTo(LeaveType,    { foreignKey: 'leaveTypeId',     as: 'leaveType'      });

// RESTRICT: deleting an employee that has ledger entries is blocked at the DB level
Employee.hasMany(LeaveBalanceLedger,      { foreignKey: 'employeeId',      as: 'ledgerEntries', onDelete: 'RESTRICT' });
LeaveBalanceLedger.belongsTo(Employee,    { foreignKey: 'employeeId',      as: 'employee',      onDelete: 'RESTRICT' });
LeaveType.hasMany(LeaveBalanceLedger,     { foreignKey: 'leaveTypeId',     as: 'ledgerEntries'  });
LeaveBalanceLedger.belongsTo(LeaveType,   { foreignKey: 'leaveTypeId',     as: 'leaveType'      });
LeaveRequest.hasMany(LeaveBalanceLedger,  { foreignKey: 'relatedRequestId', as: 'ledgerEntries' });
LeaveBalanceLedger.belongsTo(LeaveRequest,{ foreignKey: 'relatedRequestId', as: 'request'       });

LeaveRequest.hasMany(LeaveRequestAudit,  { foreignKey: 'requestId', as: 'auditEntries' });
LeaveRequestAudit.belongsTo(LeaveRequest,{ foreignKey: 'requestId', as: 'request'      });

app.use('/employees',     employeeRoutes);
app.use('/departments',   departmentRoutes);
app.use('/leave-requests', leaveRoutes);

app.get('/',       (_req, res) => res.send('Employee Service Online'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'employee-service' }));

const startServer = async () => {
  await connectDB();
  // Sequelize alter:true cannot add values to an existing Postgres ENUM type.
  // Run this idempotent statement so 'on_leave' is always present before sync.
  try {
    await sequelize.query(
      `ALTER TYPE "enum_Employees_status" ADD VALUE IF NOT EXISTS 'on_leave'`,
      { raw: true }
    );
  } catch (_) { /* type doesn't exist yet on first run — sync will create it with all values */ }
  await sequelize.sync({ alter: true });
  logger.info('Tables synced');
  // Partial index for consumption idempotency (Postgres only; ignored in SQLite)
  try {
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_consumption_per_request
       ON leave_balance_ledger (related_request_id)
       WHERE entry_type = 'consumption'`,
      { raw: true }
    );
  } catch (_) { /* SQLite in tests does not support partial indexes */ }
  await seedLeaveTypes();
  startLeaveJobs();
  app.listen(PORT, async () => {
    logger.info(`Employee Service running on http://localhost:${PORT}`);
    await register();
    startHeartbeat();
  });
  startConsumer();  // RabbitMQ consumer — non-blocking, retries internally
  startGrpcServer(); // gRPC server on port 50051
};

startServer();
