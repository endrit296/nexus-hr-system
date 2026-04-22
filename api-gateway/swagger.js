const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nexus HR System API',
      version: '1.0.0',
      description:
        'RESTful API for the Nexus HR System — microservices architecture with API Gateway, JWT auth, RBAC, and Redis caching.',
    },
    servers: [
      { url: 'http://localhost:8080', description: 'API Gateway (dev)' },
      { url: 'http://localhost',      description: 'Nginx load balancer (Docker)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', format: 'password', example: 'admin123' },
          },
        },
        TokenResponse: {
          type: 'object',
          properties: {
            token:        { type: 'string', description: 'JWT access token (15 min TTL)' },
            refreshToken: { type: 'string', description: 'Refresh token (7 day TTL)' },
            user: {
              type: 'object',
              properties: {
                id:       { type: 'string' },
                username: { type: 'string' },
                email:    { type: 'string', format: 'email' },
                role:     { type: 'string', enum: ['admin', 'manager', 'employee'] },
              },
            },
          },
        },
        HateoasLinks: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              href:   { type: 'string' },
              method: { type: 'string' },
            },
          },
        },
        Employee: {
          type: 'object',
          properties: {
            id:           { type: 'integer' },
            firstName:    { type: 'string' },
            lastName:     { type: 'string' },
            email:        { type: 'string', format: 'email' },
            phone:        { type: 'string', nullable: true },
            position:     { type: 'string', nullable: true },
            status:       { type: 'string', enum: ['active', 'inactive', 'on_leave'] },
            hireDate:     { type: 'string', format: 'date', nullable: true },
            salary:       { type: 'number', nullable: true },
            departmentId: { type: 'integer', nullable: true },
            managerId:    { type: 'integer', nullable: true },
            _links:       { $ref: '#/components/schemas/HateoasLinks' },
          },
        },
        Department: {
          type: 'object',
          properties: {
            id:            { type: 'integer' },
            name:          { type: 'string' },
            employeeCount: { type: 'integer' },
            _links:        { $ref: '#/components/schemas/HateoasLinks' },
          },
        },
        PayrollRequest: {
          type: 'object',
          required: ['employeeName', 'role', 'hourlyRate', 'hoursWorked'],
          properties: {
            employeeName: { type: 'string', example: 'Jane Doe' },
            role:         { type: 'string', example: 'Software Developer' },
            hourlyRate:   { type: 'number', example: 15 },
            hoursWorked:  { type: 'number', example: 142 },
          },
        },
        Error: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login and obtain JWT tokens',
          security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } } },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            429: { description: 'Rate limit exceeded (20 req / 15 min)' },
          },
        },
      },
      '/api/v1/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user account',
          security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            201: { description: 'User registered successfully' },
            409: { description: 'Username or email already exists' },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token using refresh token',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } },
          },
          responses: {
            200: { description: 'New access token', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },
      '/api/v1/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout and invalidate refresh token',
          security: [],
          responses: { 200: { description: 'Logged out successfully' } },
        },
      },
      '/api/v1/employees': {
        get: {
          tags: ['Employees'],
          summary: 'List all employees (cached, 30s TTL)',
          responses: {
            200: { description: 'Employee list with HATEOAS links', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, employees: { type: 'array', items: { $ref: '#/components/schemas/Employee' } } } } } } },
          },
        },
        post: {
          tags: ['Employees'],
          summary: 'Create employee (admin only)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } },
          responses: {
            201: { description: 'Employee created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } },
            400: { description: 'Validation error' },
            403: { description: 'Admin role required' },
          },
        },
      },
      '/api/v1/employees/{id}': {
        get: {
          tags: ['Employees'],
          summary: 'Get employee by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Employee record', content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } },
            404: { description: 'Employee not found' },
          },
        },
        put: {
          tags: ['Employees'],
          summary: 'Update employee (admin or manager for direct reports)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } },
          responses: {
            200: { description: 'Employee updated' },
            403: { description: 'Insufficient permissions' },
            404: { description: 'Employee not found' },
          },
        },
        delete: {
          tags: ['Employees'],
          summary: 'Delete employee (admin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Employee deleted' },
            403: { description: 'Admin role required' },
            404: { description: 'Employee not found' },
          },
        },
      },
      '/api/v1/departments': {
        get: {
          tags: ['Departments'],
          summary: 'List all departments (cached, 30s TTL)',
          responses: {
            200: { description: 'Department list with HATEOAS links', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, departments: { type: 'array', items: { $ref: '#/components/schemas/Department' } } } } } } },
          },
        },
        post: {
          tags: ['Departments'],
          summary: 'Create department (admin only)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Department' } } } },
          responses: {
            201: { description: 'Department created' },
            403: { description: 'Admin role required' },
            409: { description: 'Department name already exists' },
          },
        },
      },
      '/api/v1/departments/{id}': {
        delete: {
          tags: ['Departments'],
          summary: 'Delete department (admin only, must have no employees)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Department deleted' },
            400: { description: 'Department still has employees assigned' },
            403: { description: 'Admin role required' },
            404: { description: 'Department not found' },
          },
        },
      },
      '/api/v1/payroll/calculate': {
        post: {
          tags: ['Payroll'],
          summary: 'Calculate payroll for an employee',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PayrollRequest' } } } },
          responses: {
            200: { description: 'Payroll report generated successfully' },
            500: { description: 'Payroll calculation error' },
          },
        },
      },
      '/api/registry': {
        get: {
          tags: ['Gateway'],
          summary: 'Service registry — lists all registered microservices',
          security: [],
          responses: {
            200: { description: 'Service registry object with URLs and endpoints' },
          },
        },
      },
      '/health': {
        get: {
          tags: ['Gateway'],
          summary: 'Gateway health check',
          security: [],
          responses: { 200: { description: 'Gateway is running' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = { swaggerSpec };
