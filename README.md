# Nexus HR System

A production-grade Human Resources management platform built on a **microservices architecture**. Each domain is isolated into an independently deployable service, connected through a central API Gateway with JWT authentication, circuit breaking, rate limiting, and OpenAPI documentation.

> **Live demo:** [https://nexus-hr-frontend.onrender.com](https://nexus-hr-frontend.onrender.com)  
> **API Gateway:** [https://api-gateway-dsb8.onrender.com](https://api-gateway-dsb8.onrender.com)  
> **API Docs:** [https://api-gateway-dsb8.onrender.com/api/docs](https://api-gateway-dsb8.onrender.com/api/docs)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Authentication Flow](#authentication-flow)
- [Monitoring & Observability](#monitoring--observability)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Browser                                  │
│                 React 18 · Vite · Zustand · Axios                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Nginx  (port 80/443)                         │
│              Static file serving · Reverse proxy                    │
└────────────┬────────────────────────────────────┬───────────────────┘
             │ /api/*                              │ /*
             ▼                                     ▼
┌──────────────────────────┐             ┌──────────────────┐
│       API Gateway        │             │    Frontend SPA   │
│       port 8080          │             │   React + Vite    │
│                          │             └──────────────────┘
│  JWT verification        │
│  Rate limiting           │
│  Circuit breaker         │
│  Service discovery       │
│  OpenAPI 3.0 docs        │
│  Prometheus metrics      │
└────┬──────────┬──────────┘
     │          │                   ┌────────────────────────┐
     │          └───────────────────►  Time-Tracking Service │
     │                              │  port 3005 · MongoDB   │
     ▼                              └────────────────────────┘
┌──────────────┐   ┌────────────────────────────────────────┐
│ Auth Service │   │           Employee Service             │
│ port 3001    │   │           port 3002                    │
│ MongoDB      │   │                                        │
└──────┬───────┘   │  PostgreSQL · Redis · RabbitMQ · gRPC  │
       │           └─────────┬────────────┬─────────────────┘
       ▼                     ▼            ▼
  MongoDB              PostgreSQL       Redis
  nexus_auth           nexus_hr         Cache (30s TTL)

       ┌────────────────────────────────────────────┐
       │           Observability Stack              │
       │  Prometheus · Grafana · Loki · Promtail    │
       └────────────────────────────────────────────┘
```

**Key design decisions:**

- The frontend only ever communicates with **Nginx → API Gateway** — no direct service-to-service calls from the browser
- The gateway validates JWTs and forwards `X-User-Id`, `X-User-Role`, `X-Username`, and `X-User-Email` headers to downstream services so each service never touches the JWTs secret
- Versioned routes at `/api/v1/*` with legacy `/api/*` aliases for backwards compatibility
- **Cache-aside** pattern via Redis (30 s TTL) on all list endpoints in the employee service with explicit invalidation on mutations
- **HATEOAS** `_links` on every resource response for discoverability
- JWT access tokens expire in **15 minutes**; refresh tokens live **7 days** and are stored in MongoDB with a TTL index for automatic cleanup
- **Circuit breaker** (Opossum) per downstream service — prevents cascade failures when a service is unavailable
- **RabbitMQ** event bus (`employee_events` exchange) for asynchronous cross-service communication
- **gRPC** channel between the time-tracking service and the employee service for synchronous internal calls
- Structured JSON logging via **Winston + Morgan** across all four services

---

## Tech Stack

### Frontend

| Library | Version | Purpose |
|---|---|---|
| React | ^18.2.0 | UI component framework |
| React DOM | ^18.2.0 | DOM rendering |
| React Router DOM | ^7.14.1 | Client-side routing |
| Vite | ^5.0.0 | Build tool and dev server (HMR) |
| Tailwind CSS | ^3.4.19 | Utility-first CSS framework |
| PostCSS | ^8.5.10 | CSS processing pipeline |
| Autoprefixer | ^10.5.0 | Vendor prefix automation |
| Zustand | ^4.5.2 | Lightweight global state management |
| Axios | ^1.6.2 | HTTP client with interceptors |
| React Hook Form | ^7.73.1 | Performant form state management |
| @hookform/resolvers | ^5.2.2 | Zod schema integration for forms |
| Zod | ^4.3.6 | TypeScript-first runtime schema validation |
| Recharts | ^2.12.7 | Composable chart library |
| @headlessui/react | ^2.2.10 | Unstyled, accessible UI primitives |
| react-hot-toast | ^2.6.0 | Non-blocking toast notifications |
| Cypress | ^15.14.1 | End-to-end browser testing |
| @vitejs/plugin-react | ^4.2.1 | Vite plugin for React fast refresh |

### API Gateway

| Library | Version | Purpose |
|---|---|---|
| Express | ^4.18.2 | HTTP server and router |
| http-proxy-middleware | ^3.0.3 | Reverse proxy with path rewriting |
| jsonwebtoken | ^9.0.2 | JWT verification |
| cors | ^2.8.5 | Cross-origin resource sharing |
| helmet | ^8.0.0 | HTTP security headers |
| express-rate-limit | ^7.1.5 | Brute-force and DDoS protection |
| opossum | ^9.0.0 | Circuit breaker for downstream services |
| morgan | ^1.10.0 | HTTP request access logger |
| winston | ^3.11.0 | Structured JSON application logger |
| joi | ^17.11.0 | Request body validation |
| prom-client | ^15.1.3 | Prometheus metrics exposition |
| swagger-jsdoc | ^6.2.8 | OpenAPI 3.0 spec generation from JSDoc |
| swagger-ui-express | ^5.0.0 | Interactive API documentation UI |
| axios | ^1.15.2 | HTTP client for circuit breaker health probes |
| nodemon | ^3.0.2 | _(dev)_ Live-reload on file changes |

### Auth Service

| Library | Version | Purpose |
|---|---|---|
| Express | ^4.18.2 | HTTP server and router |
| Mongoose | ^8.0.0 | MongoDB ODM with schema validation |
| bcryptjs | ^2.4.3 | Password hashing (salt rounds: 10) |
| jsonwebtoken | ^9.0.2 | JWT signing and verification |
| nodemailer | ^6.10.1 | Email delivery (password reset, activation) |
| joi | ^17.11.0 | Input validation schemas |
| helmet | ^8.0.0 | HTTP security headers |
| express-rate-limit | ^7.1.5 | Per-route rate limiting |
| morgan | ^1.10.0 | HTTP access logging |
| winston | ^3.11.0 | Structured application logging |
| dotenv | ^16.3.1 | Environment variable loading |
| jest | ^29.7.0 | _(dev)_ Test runner |
| supertest | ^6.3.4 | _(dev)_ HTTP integration testing |
| mongodb-memory-server | ^9.4.1 | _(dev)_ In-memory MongoDB for tests |
| nodemon | ^3.0.2 | _(dev)_ Live-reload |

### Employee Service

| Library | Version | Purpose |
|---|---|---|
| Express | ^4.18.2 | HTTP server and router |
| Sequelize | ^6.35.0 | PostgreSQL ORM with migrations |
| sequelize-cli | ^6.6.5 | Database migration and seeding CLI |
| pg | ^8.11.3 | PostgreSQL native driver |
| pg-hstore | ^2.3.4 | Serializes/deserializes JSON for PostgreSQL |
| ioredis | ^5.10.1 | Redis client with cluster and Sentinel support |
| amqplib | ^1.0.3 | RabbitMQ AMQP 0-9-1 client |
| @grpc/grpc-js | ^1.14.3 | gRPC server and client runtime |
| @grpc/proto-loader | ^0.7.15 | Loads `.proto` definitions at runtime |
| node-schedule | ^2.1.1 | Cron-style scheduler (leave accrual jobs) |
| joi | ^17.11.0 | Request body validation |
| helmet | ^8.0.0 | HTTP security headers |
| morgan | ^1.10.0 | HTTP access logging |
| winston | ^3.11.0 | Structured application logging |
| dotenv | ^16.3.1 | Environment variable loading |
| jest | ^29.7.0 | _(dev)_ Test runner |
| supertest | ^6.3.4 | _(dev)_ HTTP integration testing |
| sqlite3 | ^5.1.7 | _(dev)_ In-memory SQLite for tests |
| nodemon | ^3.0.2 | _(dev)_ Live-reload |

### Time-Tracking Service

| Library | Version | Purpose |
|---|---|---|
| Express | ^4.18.2 | HTTP server and router |
| Mongoose | ^7.0.0 | MongoDB ODM |
| cors | ^2.8.5 | Cross-origin resource sharing |
| helmet | ^8.0.0 | HTTP security headers |
| morgan | ^1.10.0 | HTTP access logging |
| joi | ^18.2.1 | Request body validation |
| winston | ^3.11.0 | Structured application logging |
| @grpc/grpc-js | ^1.14.3 | gRPC client (calls employee service) |
| @grpc/proto-loader | ^0.7.15 | Loads `.proto` definitions at runtime |
| dotenv | ^16.0.3 | Environment variable loading |
| jest | ^29.7.0 | _(dev)_ Test runner |
| supertest | ^6.3.4 | _(dev)_ HTTP integration testing |
| nodemon | ^3.0.2 | _(dev)_ Live-reload |

### Infrastructure

| Component | Image / Version | Purpose |
|---|---|---|
| Node.js | 18-alpine / 20-alpine | Service runtime |
| Nginx | nginx:alpine | Reverse proxy and static file server |
| PostgreSQL | postgres:15-alpine | Relational data (employees, leave) |
| MongoDB | mongo:7 | Document store (users, tokens, time logs) |
| Redis | redis:7-alpine | Cache layer (30 s TTL list endpoints) |
| RabbitMQ | rabbitmq:3-management-alpine | Async messaging (`employee_events` exchange) |
| Prometheus | prom/prometheus | Metrics collection |
| Grafana | grafana/grafana | Metrics visualisation (admin / nexus123) |
| Loki | grafana/loki | Log aggregation |
| Promtail | grafana/promtail | Log shipping from Docker containers |

---

## Project Structure

```
nexus-hr-system/
├── api-gateway/
│   ├── index.js              # Proxy routes, JWT middleware, rate limiters, Swagger mount
│   ├── breaker.js            # Opossum circuit breaker factory (one instance per service)
│   ├── config.js             # Env helpers, CORS origins, port resolution
│   ├── registry.js           # In-memory service discovery registry
│   ├── metrics.js            # Prometheus counter + histogram instrumentation
│   ├── swagger.js            # OpenAPI 3.0 spec definition
│   ├── logger.js             # Winston logger
│   ├── Dockerfile
│   └── package.json
│
├── auth-service/
│   ├── index.js              # Express app, DB connect, route mount, service registration
│   ├── db.js                 # Mongoose connection with retry logic
│   ├── config.js             # Env helpers (MONGODB_URI, JWT_SECRET, GATEWAY_URL)
│   ├── registerService.js    # Self-registration and heartbeat to the gateway
│   ├── logger.js
│   ├── models/
│   │   ├── User.js           # Schema: username, email, password, role, verification tokens
│   │   ├── RefreshToken.js   # Schema: token, userId, expiresAt (TTL index)
│   │   └── AuditLog.js       # Schema: userId, action, details, ipAddress, timestamp
│   ├── routes/
│   │   └── auth.js           # All /auth/* route handlers
│   ├── application/          # Use-case layer (command handlers)
│   ├── domain/               # Domain entities and value objects
│   ├── infrastructure/       # Repo implementations, email adapter
│   ├── tests/
│   │   └── auth.test.js      # 15 Jest + Supertest integration tests
│   ├── Dockerfile
│   └── package.json
│
├── employee-service/
│   ├── index.js              # DB sync, associations, route mount, worker startup
│   ├── cache.js              # ioredis wrapper with graceful degradation
│   ├── consumer.js           # RabbitMQ consumer for employee_events
│   ├── messenger.js          # RabbitMQ publisher
│   ├── registerService.js    # Self-registration and heartbeat to the gateway
│   ├── runtimeConfig.js      # Environment-aware configuration
│   ├── logger.js
│   ├── config/
│   │   └── config.js         # Sequelize multi-environment config
│   ├── middleware/
│   │   └── auth.js           # requireRole() — reads X-User-Role header
│   ├── models/
│   │   ├── Employee.js       # Sequelize model (paranoid soft-delete, indexes)
│   │   ├── Department.js     # Sequelize model
│   │   ├── LeaveRequest.js   # State machine: pending → approved/rejected/withdrawn
│   │   ├── LeaveType.js      # annual, sick
│   │   ├── LeaveBalanceLedger.js  # Double-entry ledger for leave balances
│   │   └── LeaveRequestAudit.js  # Immutable audit trail per leave event
│   ├── migrations/           # Sequelize migration files
│   ├── seeds/                # Sequelize seeders for demo departments and employees
│   ├── routes/
│   │   ├── employee.js       # GET/POST/PUT/DELETE /employees (HATEOAS + cache)
│   │   ├── department.js     # GET/POST/DELETE /departments (HATEOAS + cache)
│   │   └── leaveRequest.js   # Full leave request lifecycle
│   ├── application/          # Use-case handlers
│   ├── domain/               # Domain services and validators
│   ├── grpc/                 # gRPC server definition + proto file
│   ├── jobs/                 # node-schedule leave accrual cron jobs
│   ├── tests/
│   │   └── employee.test.js  # 13 Jest + Supertest + SQLite integration tests
│   ├── Dockerfile
│   └── package.json
│
├── time-tracking-service/
│   ├── index.js              # Express app, MongoDB connect, route mount
│   ├── logger.js
│   ├── models/
│   │   └── TimeLog.js        # Schema: employeeId, checkIn, checkOut, hoursWorked
│   ├── routes/               # /time/* route handlers
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── client.js     # Axios instance + silent refresh + 502 retry interceptors
│       │   ├── authStorage.js # localStorage token helpers
│       │   └── config.js     # API base URL, endpoint constants
│       ├── store/
│       │   └── useAuthStore.js  # Zustand store persisted to localStorage
│       ├── context/          # React context providers
│       ├── components/
│       │   ├── Layout.jsx    # Sidebar + topbar shell
│       │   └── ui/           # Avatar, Button, Input, DataTable, StatusBadge, Modal …
│       ├── pages/
│       │   ├── DashboardHome.jsx   # KPI stat cards + Pie/Bar/Line charts (Recharts)
│       │   ├── EmployeesPage.jsx   # Full employee CRUD table with search
│       │   ├── DepartmentsPage.jsx # Department management
│       │   ├── OrgChartPage.jsx    # Interactive hierarchy tree
│       │   ├── ProfilePage.jsx     # My profile + direct reports
│       │   ├── LeaveRequestsPage.jsx # Leave request workflow
│       │   └── PayrollPage.jsx     # Payroll calculator
│       ├── modals/           # Create/edit modal components
│       ├── utils/            # Shared utilities
│       ├── App.jsx           # Route definitions and auth guard
│       └── main.jsx          # React entry point
│
├── docs/
│   ├── schema.sql            # Full PostgreSQL DDL (tables, indexes, trigger, procedure)
│   ├── messaging/
│   │   └── event-flow.md     # RabbitMQ exchange and routing key design
│   └── grpc/
│       └── employees.proto   # proto3: EmployeeService, DepartmentService
│
├── nginx/
│   └── nginx.conf            # Upstream blocks, proxy_pass, gzip, SSL config
├── monitoring/               # Prometheus and Grafana configuration
├── k8s/                      # Kubernetes manifests
├── helm/                     # Helm chart
├── tests/                    # Cross-service integration tests
├── scripts/                  # Database seed scripts
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Prerequisites

### Docker (recommended)

| Tool | Version |
|---|---|
| Docker Desktop | 4.x+ |

That is the only requirement. Docker Compose will pull all images and wire everything together.

### Manual / Development

| Tool | Minimum Version |
|---|---|
| Node.js | v18.0.0 (v22 recommended) |
| PostgreSQL | v14 |
| MongoDB | v6 |
| Redis | v7 |
| RabbitMQ | v3.11 |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/endrit296/nexus-hr-system.git
cd nexus-hr-system

# 2. Create your environment file from the template
cp .env.example .env
# Open .env and replace placeholder values before deploying to production

# 3. Start all services
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost | Application (via Nginx) |
| http://localhost:8080/api/docs | Swagger / OpenAPI 3.0 |
| http://localhost:8080/health | API Gateway health check |
| http://localhost:8080/metrics | Prometheus metrics endpoint |
| http://localhost:8080/api/registry | Service discovery registry |
| http://localhost:3000 | Grafana dashboards |
| http://localhost:15672 | RabbitMQ management UI |
| http://localhost:9090 | Prometheus UI |

### Manual Development Mode

Run each service in a separate terminal:

```bash
# Auth Service
cd auth-service && npm run dev

# Employee Service
cd employee-service && npm run dev

# Time-Tracking Service
cd time-tracking-service && npm run dev

# API Gateway
cd api-gateway && npm run dev

# Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

### Re-seeding demo data

```bash
docker cp scripts/seed-auth.js nexus-hr-system-auth-service-1:/app/seed-auth.js
docker exec nexus-hr-system-auth-service-1 node seed-auth.js

docker cp scripts/seed-employees.js nexus-hr-system-employee-service-1:/app/seed-employees.js
docker exec nexus-hr-system-employee-service-1 node seed-employees.js
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values before starting.

### Root `.env`

| Variable | Development Default | Description |
|---|---|---|
| `JWT_SECRET` | `nexus_jwt_secret_change_in_production` | HMAC-SHA256 key for signing all JWTs. **Must be changed in production.** |
| `DB_PASS` | `password` | PostgreSQL user password |
| `POSTGRES_PASSWORD` | `password` | PostgreSQL superuser password |
| `APP_URL` | `http://localhost` | Base URL for email links (password reset, activation) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed CORS origins |
| `FROM_EMAIL` | _(your email)_ | Sender address for transactional emails |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP relay host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS (`true`) or STARTTLS (`false`) |
| `SMTP_USER` | _(your email)_ | SMTP login |
| `SMTP_PASS` | _(app password)_ | SMTP password or app-specific password |

### Auth Service

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://mongo:27017/nexus_auth` | MongoDB connection string |
| `JWT_SECRET` | _(from root .env)_ | JWT signing key |
| `PORT` | `3001` | HTTP listen port |
| `GATEWAY_HOST` | `api-gateway` | Gateway hostname for service registration |
| `GATEWAY_PORT` | `8080` | Gateway port |
| `SERVICE_URL` | _(auto)_ | This service's public URL |

### Employee Service

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `nexus_hr` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASS` | _(from root .env)_ | Database password |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `RABBITMQ_URL` | `amqp://rabbitmq:5672` | RabbitMQ connection string |
| `PORT` | `3002` | HTTP listen port |
| `GRPC_PORT` | `50051` | gRPC listen port |
| `GATEWAY_HOST` | `api-gateway` | Gateway hostname |
| `SERVICE_URL` | _(auto)_ | This service's public URL |

### Time-Tracking Service

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://mongo:27017/nexus_payroll` | MongoDB connection string |
| `PORT` | `3005` | HTTP listen port |
| `RABBITMQ_URL` | `amqp://rabbitmq:5672` | RabbitMQ connection string |
| `EMPLOYEE_GRPC_URL` | `employee-service:50051` | gRPC target for employee lookups |
| `GATEWAY_HOST` | `api-gateway` | Gateway hostname |
| `SERVICE_URL` | _(auto)_ | This service's public URL |

### API Gateway

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | _(from root .env)_ | JWT verification key |
| `AUTH_SERVICE_URL` | `http://auth-service:3001` | Auth service internal URL |
| `EMPLOYEE_SERVICE_URL` | `http://employee-service:3002` | Employee service internal URL |
| `PAYROLL_SERVICE_URL` | `http://time-tracking-service:3005` | Payroll service internal URL |
| `PORT` | `8080` | HTTP listen port |
| `CORS_ALLOWED_ORIGINS` | _(from root .env)_ | Comma-separated allowed origins |

> `.env` files are listed in `.gitignore` — never commit secrets.

---

## Demo Accounts

All demo accounts share the password: **`Password123`**

| Role | Email | Name | Position |
|---|---|---|---|
| **admin** | admin@nexushr.com | Admin | CEO |
| **manager** | bob@nexushr.com | Bob Smith | CTO |
| **manager** | frank@nexushr.com | Frank Miller | CMO |
| **manager** | karen@nexushr.com | Karen Martinez | HR Director |
| **manager** | ivy@nexushr.com | Ivy Chen | CFO |
| **manager** | mike@nexushr.com | Mike Thompson | VP of Sales |
| **employee** | carol@nexushr.com | Carol White | Senior Software Engineer |
| **employee** | david@nexushr.com | David Lee | Senior Software Engineer |
| **employee** | emma@nexushr.com | Emma Davis | Junior Software Engineer |
| **employee** | grace@nexushr.com | Grace Wilson | Marketing Specialist |
| **employee** | henry@nexushr.com | Henry Brown | Content Writer |
| **employee** | jack@nexushr.com | Jack Taylor | Financial Analyst |
| **employee** | liam@nexushr.com | Liam Anderson | HR Specialist |
| **employee** | nina@nexushr.com | Nina Roberts | Sales Representative |
| **employee** | oscar@nexushr.com | Oscar Garcia | Sales Representative |

### Role Permissions

| Feature | Employee | Manager | Admin |
|---|:---:|:---:|:---:|
| View employee directory and org chart | ✓ | ✓ | ✓ |
| View dashboard analytics and charts | ✓ | ✓ | ✓ |
| View departments | ✓ | ✓ | ✓ |
| Submit leave requests | ✓ | ✓ | ✓ |
| Edit own phone number | ✓ | ✓ | ✓ |
| View and generate payroll reports | ✓ | ✓ | ✓ |
| Approve / reject leave requests | ✗ | ✓ | ✓ |
| Edit direct subordinates | ✗ | ✓ | ✓ |
| View / edit salary fields | ✗ | ✗ | ✓ |
| Add / delete employees | ✗ | ✗ | ✓ |
| Add / delete departments | ✗ | ✗ | ✓ |
| Manage user roles | ✗ | ✗ | ✓ |
| View audit logs | ✗ | ✗ | ✓ |

---

## API Reference

All requests are routed through the API Gateway. Versioned routes (`/api/v1/*`) are preferred. Legacy aliases (`/api/*`) also work.

> Full interactive documentation is available at **`/api/docs`** (Swagger UI).

### Authentication — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user account |
| `POST` | `/auth/login` | Public · rate limited | Authenticate and receive JWT pair |
| `POST` | `/auth/logout` | Public | Invalidate a refresh token |
| `POST` | `/auth/refresh` | Public | Exchange refresh token for a new access token |
| `GET` | `/auth/activate/:token` | Public | Verify email address |
| `POST` | `/auth/forgot-password` | Public | Trigger password reset email |
| `POST` | `/auth/reset-password/:token` | Public | Set new password with reset token |
| `PUT` | `/auth/change-password` | JWT | Change password (authenticated) |
| `GET` | `/auth/me` | JWT | Get current user profile |
| `GET` | `/auth/users` | JWT · admin | List all users (paginated) |
| `PUT` | `/auth/users/:id/role` | JWT · admin | Change a user's role |
| `DELETE` | `/auth/users/:id` | JWT · admin | Delete a user account |
| `GET` | `/auth/audit-logs` | JWT · admin | Paginated auth audit trail |

#### POST `/auth/login`

```json
// Request
{ "email": "admin@nexushr.com", "password": "Password123" }

// Response 200
{
  "token": "<15-minute JWT>",
  "refreshToken": "<7-day token>",
  "user": { "id": "...", "username": "admin", "email": "admin@nexushr.com", "role": "admin" }
}
```

#### POST `/auth/refresh`

```json
// Request
{ "refreshToken": "<token>" }

// Response 200
{ "token": "<new 15-minute JWT>" }
```

---

### Employees — `/api/v1/employees`

All endpoints require `Authorization: Bearer <token>`. Responses include `_links` (HATEOAS).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/employees` | JWT | List all employees, paginated, Redis-cached 30 s |
| `GET` | `/employees/me` | JWT | Authenticated user's employee record |
| `PUT` | `/employees/me` | JWT | Update own phone number |
| `GET` | `/employees/:id` | JWT | Single employee by ID |
| `GET` | `/employees/:id/leave-balance` | JWT | Employee's current leave balance |
| `POST` | `/employees` | JWT · admin | Create a new employee |
| `PUT` | `/employees/:id` | JWT · admin / manager | Update employee (managers: direct reports only, no salary) |
| `DELETE` | `/employees/:id` | JWT · admin | Soft-delete an employee |

**Sample response:**

```json
{
  "id": 1,
  "firstName": "Carol",
  "lastName": "White",
  "email": "carol@nexushr.com",
  "position": "Senior Software Engineer",
  "status": "active",
  "salary": 85000.00,
  "department": { "id": 2, "name": "Engineering" },
  "_links": {
    "self":       { "href": "/api/v1/employees/1", "method": "GET" },
    "update":     { "href": "/api/v1/employees/1", "method": "PUT" },
    "delete":     { "href": "/api/v1/employees/1", "method": "DELETE" },
    "collection": { "href": "/api/v1/employees",   "method": "GET" }
  }
}
```

---

### Departments — `/api/v1/departments`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/departments` | JWT | List departments with headcount, Redis-cached 30 s |
| `GET` | `/departments/:id` | JWT | Single department |
| `POST` | `/departments` | JWT · admin | Create a department |
| `DELETE` | `/departments/:id` | JWT · admin | Delete department (blocked if employees are assigned) |

---

### Leave Requests — `/api/v1/leave-requests`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/leave-requests` | JWT | Submit a new leave request |
| `GET` | `/leave-requests` | JWT | List requests (filterable by status, type, date range) |
| `GET` | `/leave-requests/:id` | JWT | Single leave request |
| `POST` | `/leave-requests/:id/approve` | JWT · manager / admin | Approve a pending request |
| `POST` | `/leave-requests/:id/reject` | JWT · manager / admin | Reject a pending request |
| `POST` | `/leave-requests/:id/withdraw` | JWT | Withdraw own pending request |

---

### Payroll — `/api/v1/payroll`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/payroll/calculate` | JWT · admin / manager | Generate payroll statement |
| `GET` | `/payroll/employee/:id` | JWT · admin / manager | Get employee payroll history |
| `POST` | `/payroll/time/clock-in` | JWT | Record clock-in |
| `POST` | `/payroll/time/clock-out` | JWT | Record clock-out |
| `GET` | `/payroll/time/my` | JWT | Own time logs |
| `GET` | `/payroll/time/employee/:id` | JWT · admin / manager | Employee's time logs |

**Payroll response:**

```json
{
  "header": {
    "company": "NEXUS HR SOLUTIONS",
    "report_type": "Monthly Payroll Statement",
    "date": "2026-05-01"
  },
  "employee_profile": { "full_name": "Carol White", "position": "Senior Software Engineer" },
  "financial_summary": {
    "hours_logged": "160 hrs",
    "rate_per_hour": "45.00 €",
    "gross_total": "7200.00 €",
    "deductions": "720.00 € (Tax 10%)",
    "final_net_salary": "6480.00 €"
  },
  "status": "VERIFIED"
}
```

---

### Gateway Utilities

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | Gateway liveness probe |
| `GET` | `/health` | Public | Structured health check |
| `GET` | `/metrics` | Public | Prometheus metrics (text format) |
| `GET` | `/api/docs` | Public | Swagger UI |
| `GET` | `/api/docs.json` | Public | Raw OpenAPI 3.0 JSON spec |
| `GET` | `/api/registry` | Public | Registered services + their URLs |
| `POST` | `/api/registry/register` | Public | Register a new microservice |
| `POST` | `/api/registry/heartbeat` | Public | Service liveness heartbeat |

All responses include the `X-API-Version: 1.0` header.

---

## Database Schema

### MongoDB — `nexus_auth` (Auth Service)

**Collection: users**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `username` | String | required, unique, trimmed |
| `email` | String | required, unique, lowercase |
| `password` | String | required, bcrypt-hashed (10 rounds) |
| `role` | String | enum: `admin` `manager` `employee`, default: `employee` |
| `isVerified` | Boolean | default: false |
| `activationToken` | String | one-time email verification token |
| `activationTokenExpiry` | Date | |
| `resetPasswordToken` | String | |
| `resetPasswordExpiry` | Date | |
| `createdAt` | Date | auto |

**Collection: refreshtokens**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `token` | String | required, unique |
| `userId` | ObjectId | ref: User, required |
| `expiresAt` | Date | required — TTL index for automatic deletion |

**Collection: auditlogs**

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | PK |
| `userId` | ObjectId | ref: User |
| `username` | String | |
| `action` | String | `REGISTER` `LOGIN` `LOGIN_FAILED` `LOGOUT` `PASSWORD_CHANGE` `PASSWORD_RESET` `ROLE_CHANGE` `DELETE_USER` |
| `details` | Object | Action-specific metadata |
| `ipAddress` | String | Client IP |
| `timestamp` | Date | Indexed descending |

---

### PostgreSQL — `nexus_hr` (Employee Service)

**Table: employees**

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK, auto-increment |
| `firstName` | VARCHAR | NOT NULL |
| `lastName` | VARCHAR | NOT NULL |
| `email` | VARCHAR | NOT NULL, UNIQUE |
| `phone` | VARCHAR | nullable |
| `position` | VARCHAR | nullable |
| `status` | ENUM | `active` `inactive` `on_leave`, default: `active` |
| `hireDate` | DATE | |
| `hourlyRate` | DECIMAL(10,2) | |
| `salary` | DECIMAL(10,2) | |
| `departmentId` | INTEGER | FK → departments (SET NULL on delete) |
| `managerId` | INTEGER | FK → employees self-reference (SET NULL on delete) |
| `deletedAt` | TIMESTAMP | Paranoid soft-delete column |
| `createdAt` | TIMESTAMP | auto |
| `updatedAt` | TIMESTAMP | auto |

Indexes: `departmentId`, `managerId`, `status`, `hireDate`, composite `(lastName, firstName)`.

**Table: departments**

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK, auto-increment |
| `name` | VARCHAR | NOT NULL, UNIQUE |
| `createdAt` | TIMESTAMP | auto |
| `updatedAt` | TIMESTAMP | auto |

**Table: leavetypes**

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `code` | VARCHAR(32) | UNIQUE — `annual`, `sick` |
| `name` | VARCHAR | NOT NULL |
| `isPaid` | BOOLEAN | default: true |
| `requiresProofAfterDays` | INTEGER | |
| `maxRetroactiveDays` | INTEGER | |

**Table: leaverequests**

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `employeeId` | INTEGER | FK → employees, NOT NULL |
| `leaveTypeId` | INTEGER | FK → leavetypes, NOT NULL |
| `startDate` | DATE | NOT NULL |
| `endDate` | DATE | NOT NULL, ≥ startDate, same calendar year |
| `workingDaysCount` | INTEGER | NOT NULL, > 0 |
| `status` | ENUM | `pending` `approved` `rejected` `withdrawn`, default: `pending` |
| `reason` | TEXT | |
| `submittedAt` | DATETIME | default: now |
| `decidedAt` | DATETIME | |
| `decidedByUserId` | VARCHAR | Soft ref to MongoDB User `_id` |
| `decisionNote` | TEXT | |
| `withdrawnAt` | DATETIME | |

Constraint: a `beforeCreate` hook blocks overlapping active leave requests per employee.

**Table: leavebalanceledgers** _(double-entry ledger)_

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `employeeId` | INTEGER | FK → employees, RESTRICT on delete |
| `leaveTypeId` | INTEGER | FK → leavetypes |
| `entryType` | ENUM | `accrual` `consumption` `adjustment` |
| `days` | DECIMAL(5,2) | signed, non-zero |
| `reason` | TEXT | NOT NULL |
| `relatedRequestId` | INTEGER | FK → leaverequests, nullable |
| `effectiveDate` | DATE | NOT NULL |
| `createdByUserId` | VARCHAR | Soft ref to MongoDB User `_id` |
| `createdAt` | DATETIME | Immutable — no `updatedAt` |

Unique partial index: `(relatedRequestId)` WHERE `entryType = 'consumption'`.

**Table: leaverequestaudits**

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `requestId` | INTEGER | FK → leaverequests |
| `eventType` | ENUM | `created` `approved` `rejected` `withdrawn` `consumed` |
| `actorUserId` | VARCHAR | Soft ref to MongoDB User `_id` |
| `payloadJson` | JSON | Full snapshot at time of event |
| `createdAt` | DATETIME | Immutable |

**Trigger:** `trg_employee_audit` fires on every `UPDATE` to `employees` that changes `status` or `salary` and writes a row to the `employee_audit_log` table.

**Stored procedure:** `get_department_stats()` — returns `(dept_name, headcount, avg_salary)` per department.

---

### MongoDB — `nexus_payroll` (Time-Tracking Service)

**Collection: timelogs**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `employeeId` | Number | required, indexed |
| `employeeNameSnapshot` | String | denormalised name at clock-in time |
| `checkIn` | Date | required |
| `checkOut` | Date | |
| `hoursWorked` | Number | computed on clock-out, default: 0 |
| `status` | String | `Active` `Completed`, default: `Active` |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

---

## Authentication Flow

```
1.  User submits login credentials
           │
           ▼
2.  Frontend → API Gateway → Auth Service
           │
           ▼
3.  Auth Service: bcrypt.compare(password, hash)
           │
           ▼
4.  Returns:
      access token  — JWT, 15-minute TTL, signed with JWT_SECRET
      refresh token — opaque, 7-day TTL, stored in MongoDB with TTL index
           │
           ▼
5.  Zustand store (persisted to localStorage) holds:
      { user, token, refreshToken }
           │
           ▼
6.  Every outbound request:
      Axios request interceptor checks token expiry (5 s buffer)
      If expired → silently calls POST /auth/refresh before sending
      Attaches:  Authorization: Bearer <token>
           │
           ▼
7.  API Gateway:
      Verifies JWT signature and expiry
      Injects downstream headers:
        X-User-Id, X-User-Role, X-Username, X-User-Email
           │
           ▼
8.  On unexpected 401:
      Interceptor calls POST /auth/refresh, retries the original request once.
      On 502 / 503 / 504: retries up to 3 times with linear backoff (3 / 6 / 9 s).
           │
           ▼
9.  On refresh failure (401 / 403 only):
      localStorage cleared → Zustand store reset → redirect to /login
```

---

## Monitoring & Observability

| Component | URL | Credentials | Purpose |
|---|---|---|---|
| Grafana | http://localhost:3000 | `admin` / `nexus123` | Metrics dashboards |
| Prometheus | http://localhost:9090 | — | Metrics query and alerting |
| Loki | http://localhost:3100 | — | Log aggregation backend |
| RabbitMQ UI | http://localhost:15672 | `guest` / `guest` | Queue management |

**Prometheus metrics** are exposed by the API Gateway at `GET /metrics` and include:
- HTTP request counter (method, route, status code)
- Request duration histogram (P50 / P95 / P99)
- Circuit breaker state per downstream service

**Loki + Promtail** collect structured JSON logs from all Docker containers and make them searchable in Grafana.

---

## Testing

```bash
# Auth Service — 15 integration tests
# Jest + Supertest + mongodb-memory-server (isolated, no external dependencies)
cd auth-service && npm test

# Employee Service — 13 integration tests
# Jest + Supertest + SQLite in-memory (no PostgreSQL required)
cd employee-service && npm test
```

**Coverage includes:**

- User registration: valid payload, duplicate email, duplicate username, invalid fields
- Login: correct credentials, wrong password, missing fields, unverified account
- Token refresh: valid token, expired token, missing token, already-used token
- Logout: token invalidation
- Employee CRUD: create, read, update, delete with role-based access checks
- Department CRUD: create, read, delete, blocked delete when employees are assigned
- Leave request lifecycle: submit, approve, reject, withdraw, overlap prevention

---

## Deployment

### Render (current production setup)

Each service is deployed as a separate **Web Service** on Render:

| Service | Build command | Start command |
|---|---|---|
| api-gateway | `npm install` | `node index.js` |
| auth-service | `npm install` | `node index.js` |
| employee-service | `npm install` | `npx sequelize-cli db:migrate && node index.js` |
| time-tracking-service | `npm install` | `node index.js` |
| frontend | `npm install && npm run build` | _(static site)_ |

**Required environment variables** for each service must be set in the Render dashboard. Use the per-service variable tables from the [Environment Variables](#environment-variables) section above.

> **Note on Render free tier:** Services spin down after 15 minutes of inactivity and take ~30 seconds to cold-start. The application handles this gracefully — the API client retries 502/503/504 responses up to 3 times with linear backoff before surfacing an error to the user.

### Docker Compose (self-hosted)

```bash
cp .env.example .env   # edit secrets
docker compose up --build -d
```

All services, databases, and observability tooling start together. Health checks are configured for RabbitMQ, PostgreSQL, and MongoDB so dependent services wait for dependencies before starting.

### Kubernetes

Helm chart and raw manifests are available under `helm/` and `k8s/` respectively.

```bash
# Helm
helm install nexus-hr ./helm --namespace nexus-hr --create-namespace

# Raw manifests
kubectl apply -f k8s/
```
