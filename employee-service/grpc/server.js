'use strict';
const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const employeeService = require('../application/services/EmployeeService');
const logger      = require('../logger');

const PROTO_PATH = path.join(__dirname, 'employees.proto');

const pkgDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase:  false,
  longs:     String,
  enums:     String,
  defaults:  true,
  oneofs:    true,
});

const { nexus: { hr: proto } } = grpc.loadPackageDefinition(pkgDef);

const mapEmployee = (emp) => ({
  id:           emp.id            || 0,
  firstName:    emp.firstName     || '',
  lastName:     emp.lastName      || '',
  email:        emp.email         || '',
  phone:        emp.phone         || '',
  position:     emp.position      || '',
  status:       emp.status        || 'active',
  hireDate:     emp.hireDate ? new Date(emp.hireDate).toISOString().slice(0, 10) : '',
  salary:       parseFloat(emp.salary) || 0,
  departmentId: emp.departmentId  || 0,
  managerId:    emp.managerId     || 0,
});

const getEmployee = async (call, callback) => {
  try {
    const emp = await employeeService.getEmployee(call.request.id);
    callback(null, { employee: mapEmployee(emp) });
  } catch (err) {
    callback({ code: grpc.status.NOT_FOUND, message: err.message });
  }
};

const listEmployees = async (call, callback) => {
  try {
    const { status, departmentId, page, pageSize } = call.request;
    const result = await employeeService.listEmployees({
      status:       status       || undefined,
      departmentId: departmentId || undefined,
      page:         page         || 1,
      limit:        pageSize     || 50,
    });
    callback(null, {
      employees: (result.employees || []).map(mapEmployee),
      total:     result.total || 0,
    });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
};

const unimplemented = (call, callback) =>
  callback({ code: grpc.status.UNIMPLEMENTED, message: 'Use the REST API for write operations' });

const startGrpcServer = () => {
  const server    = new grpc.Server();
  const GRPC_PORT = process.env.GRPC_PORT || 50051;

  server.addService(proto.EmployeeService.service, {
    getEmployee,
    listEmployees,
    createEmployee:      unimplemented,
    updateEmployee:      unimplemented,
    deleteEmployee:      unimplemented,
    watchEmployeeStatus: (call) => call.end(),
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        logger.error(`[gRPC] Bind failed: ${err.message}`);
        return;
      }
      logger.info(`[gRPC] EmployeeService listening on port ${port}`);
    }
  );

  return server;
};

module.exports = { startGrpcServer };
