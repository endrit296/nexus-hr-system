'use strict';
const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../logger');

const PROTO_PATH    = path.resolve(__dirname, '../../../docs/grpc/employees.proto');
const EMPLOYEE_GRPC = process.env.EMPLOYEE_GRPC_URL || 'localhost:50051';

const pkgDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
});

const { nexus: { hr: proto } } = grpc.loadPackageDefinition(pkgDef);

let _client = null;

const getClient = () => {
  if (!_client) {
    _client = new proto.EmployeeService(
      EMPLOYEE_GRPC,
      grpc.credentials.createInsecure()
    );
  }
  return _client;
};

const getEmployee = (id) =>
  new Promise((resolve, reject) => {
    getClient().getEmployee({ id: parseInt(id, 10) }, (err, response) => {
      if (err) {
        logger.warn(`[gRPC Client] getEmployee(${id}) failed: ${err.message}`);
        return reject(err);
      }
      resolve(response.employee);
    });
  });

const listEmployees = ({ status, departmentId, page = 1, pageSize = 50 } = {}) =>
  new Promise((resolve, reject) => {
    getClient().listEmployees(
      { status: status || '', departmentId: departmentId || 0, page, pageSize },
      (err, response) => {
        if (err) {
          logger.warn(`[gRPC Client] listEmployees failed: ${err.message}`);
          return reject(err);
        }
        resolve(response);
      }
    );
  });

module.exports = { getEmployee, listEmployees };
