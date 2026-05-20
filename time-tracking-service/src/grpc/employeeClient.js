'use strict';
const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../logger');

const PROTO_PATH    = path.join(__dirname, 'employees.proto');
const EMPLOYEE_GRPC = process.env.EMPLOYEE_GRPC_URL || 'localhost:50051';
const EMPLOYEE_SERVICE_URL = process.env.EMPLOYEE_SERVICE_URL || '';

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

const normalizeEmployee = (employee) => ({
  id: employee.id || 0,
  firstName: employee.firstName || '',
  lastName: employee.lastName || '',
  email: employee.email || '',
  phone: employee.phone || '',
  position: employee.position || '',
  status: employee.status || 'active',
  hireDate: employee.hireDate || '',
  salary: Number(employee.salary || 0),
  departmentId: employee.departmentId || 0,
  managerId: employee.managerId || 0,
});

const fetchEmployeeOverHttp = async (id) => {
  if (!EMPLOYEE_SERVICE_URL) {
    throw new Error('EMPLOYEE_SERVICE_URL is not configured');
  }

  const baseUrl = EMPLOYEE_SERVICE_URL.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/employees/${parseInt(id, 10)}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from employee-service`);
  }

  const payload = await response.json();
  return normalizeEmployee(payload);
};

const getEmployee = (id) =>
  new Promise((resolve, reject) => {
    getClient().getEmployee({ id: parseInt(id, 10) }, (err, response) => {
      if (err) {
        logger.warn(`[gRPC Client] getEmployee(${id}) failed: ${err.message}`);
        return fetchEmployeeOverHttp(id)
          .then(resolve)
          .catch((httpError) => {
            logger.warn(`[HTTP Fallback] getEmployee(${id}) failed: ${httpError.message}`);
            reject(httpError);
          });
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
