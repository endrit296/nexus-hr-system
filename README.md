# Nexus HR System

A production-grade Human Resources management platform built with a **microservices architecture**. Each concern is isolated into its own independently deployable service, connected through a central API Gateway.

## Quick Start (Docker)

```bash
# Copy secrets file (edit values before deploying to production)
cp .env.example .env

docker compose up --build
```

Open **http://localhost** in your browser.

---

## Demo Accounts

All demo accounts use the password: **`Password123`**

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
| View employee directory & org chart | ✅ | ✅ | ✅ |
| View dashboard analytics & charts | ✅ | ✅ | ✅ |
| View departments | ✅ | ✅ | ✅ |
| Edit own phone number (profile page) | ✅ | ✅ | ✅ |
| Edit direct subordinates | ❌ | ✅ | ✅ |
| View / edit salary | ❌ | ❌ | ✅ |
| Add / delete employees | ❌ | ❌ | ✅ |
| Add / delete departments | ❌ | ❌ | ✅ |
| Generate payroll reports | ✅ | ✅ | ✅ |

### Re-seeding demo data

```bash
docker cp scripts/seed-auth.js nexus-hr-system-auth-service-1:/app/seed-auth.js
docker exec nexus-hr-system-auth-service-1 node seed-auth.js

docker cp scripts/seed-employees.js nexus-hr-system-employee-service-1:/app/seed-employees.js
docker exec nexus-hr-system-employee-service-1 node seed-employees.js
```

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Reference](#api-reference)
- [Authentication Flow](#authentication-flow)
- [Database Models](#database-models)
- [Testing](#testing)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP (Axios + Zustand)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Nginx  (port 80)                              │
│              Load balancer / reverse proxy                       │
└──────┬─────────────────────────────────────┬─────────────────────┘
       │ /api/*                              │ /*
       ▼                                     ▼
┌─────────────────┐                  ┌──────────────┐
│   API Gateway   │                  │   Frontend   │
│   port 8080     │                  │  React/Vite  │
│                 │                  └──────────────┘
│ Rate limiting   │
│ JWT validation  │
│ API versioning  │
│ Swagger /docs   │
│ X-API-Version   │
└──┬──────┬───┬───┘
   │      │   │
   │      │   └──────────────────────────────────────┐
   │      │                                          │
   ▼      ▼                                          ▼
┌──────┐ ┌──────────────────┐             ┌──────────────────────┐
│Auth  │ │Employee Service  │             │Time-Tracking Service │
│:3001 │ │:3002             │             │:3005                 │
│Mongo │ │PostgreSQL+Redis  │             │MongoDB               │
└──────┘ └──────────────────┘             └──────────────────────┘
   │              │                                  │
   ▼              ▼                                  ▼
MongoDB      PostgreSQL                           MongoDB
(nexus_auth) (nexus_hr)         Redis         (nexus_payroll)
                              (cache layer)
```

**Key design decisions:**
- The frontend only ever talks to **Nginx → API Gateway** — no direct service calls
- The gateway validates JWTs and forwards `X-User-Role` / `X-User-Email` headers to downstream services
- Versioned routes at `/api/v1/*` with legacy `/api/*` aliases for backwards compatibility
- Redis cache-aside (30 s TTL) on all list endpoints in the employee service
- HATEOAS `_links` on every resource response for discoverability
- JWT access tokens expire in **15 minutes**; refresh tokens last **7 days**
- Structured JSON logging via Winston + Morgan in all four services

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | UI with fast HMR |
| Styling | Tailwind CSS v3 | Utility-first CSS |
| State management | Zustand + persist | Auth state across page reloads |
| HTTP Client | Axios | API calls + silent token refresh interceptor |
| Form validation | react-hook-form + Zod | Type-safe client-side validation |
| Charts | Recharts | Dashboard analytics visualisations |
| Toasts | react-hot-toast | Non-blocking user feedback |
| API Gateway | Express + http-proxy-middleware | Single entry point, request routing |
| Rate limiting | express-rate-limit | Brute-force protection on auth routes |
| API Docs | swagger-jsdoc + swagger-ui-express | OpenAPI 3.0 at `/api/docs` |
| Auth Service | Express + Mongoose + bcryptjs + jsonwebtoken | User registration, login, JWT + refresh tokens |
| Employee Service | Express + Sequelize + Joi | Employee / department CRUD, input validation |
| Payroll Service | Express + Mongoose | Payroll calculation, time logs |
| Cache | Redis (ioredis) | Cache-aside layer for list endpoints |
| Auth Database | MongoDB | NoSQL document store for users & refresh tokens |
| Employee Database | PostgreSQL | Relational store for employees & departments |
| Payroll Database | MongoDB | Time logs & payroll records |
| Load Balancer | Nginx | Reverse proxy, static file serving |
| Logging | Winston + Morgan | Structured JSON logs + HTTP access logs |
| Runtime | Node.js v22+ | All backend services |

---

## Project Structure

```
nexus-hr-system/
│
├── api-gateway/                    # Entry point for all client requests (port 8080)
│   ├── index.js                    # Proxy routes, rate limiting, Swagger mount
│   ├── swagger.js                  # OpenAPI 3.0 spec definition
│   ├── logger.js                   # Winston logger
│   └── package.json
│
├── auth-service/                   # Handles registration, login, JWT (port 3001)
│   ├── index.js
│   ├── db.js                       # MongoDB connection
│   ├── logger.js
│   ├── models/
│   │   ├── User.js                 # Mongoose schema: username, email, password, role
│   │   └── RefreshToken.js         # Refresh token store with expiry
│   ├── routes/
│   │   └── auth.js                 # POST /auth/register|login|refresh|logout
│   ├── tests/
│   │   └── auth.test.js            # Jest + Supertest integration tests (15 cases)
│   └── package.json
│
├── employee-service/               # Full employee & department CRUD (port 3002)
│   ├── index.js                    # DB sync, associations, route mount
│   ├── cache.js                    # ioredis wrapper with graceful degradation
│   ├── logger.js
│   ├── config/
│   │   └── database.js             # Sequelize + PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js                 # requireRole() — reads X-User-Role header
│   ├── models/
│   │   ├── Employee.js             # Sequelize model with indexes
│   │   └── Department.js           # Sequelize model
│   ├── routes/
│   │   ├── employee.js             # GET/POST/PUT/DELETE /employees (HATEOAS + cache)
│   │   └── department.js           # GET/POST/DELETE /departments (HATEOAS + cache)
│   ├── tests/
│   │   └── employee.test.js        # Jest + Supertest + SQLite in-memory (13 cases)
│   └── package.json
│
├── time-tracking-service/          # Payroll calculation (port 3005)
│   ├── server.js                   # Express app, gateway-auth guard
│   ├── src/
│   │   ├── controllers/
│   │   │   └── time.controller.js  # processSalary — validated payroll calculation
│   │   ├── models/
│   │   │   └── TimeLog.js          # Mongoose schema for time logs
│   │   ├── routes/
│   │   │   └── time.routes.js
│   │   └── logger.js
│   └── package.json
│
├── frontend/                       # React + Vite app
│   └── src/
│       ├── api/
│       │   └── client.js           # Axios instance + silent refresh interceptor
│       ├── store/
│       │   └── useAuthStore.js     # Zustand store with localStorage persist
│       ├── components/
│       │   ├── Login.jsx           # Login + register forms (Zod validation)
│       │   ├── Layout.jsx          # Sidebar + topbar shell
│       │   └── ui/                 # Avatar, Button, Input, DataTable, StatusBadge …
│       └── pages/
│           ├── DashboardHome.jsx   # Stat cards + Pie/Bar/Line charts
│           ├── EmployeesPage.jsx   # Full employee CRUD table
│           ├── DepartmentsPage.jsx # Department management
│           ├── OrgChartPage.jsx    # Interactive org chart
│           ├── ProfilePage.jsx     # My profile + direct reports
│           └── PayrollPage.jsx     # Payroll calculator
│
├── docs/
│   ├── schema.sql                  # Full PostgreSQL DDL (tables, indexes, trigger, procedure)
│   ├── messaging/
│   │   └── event-flow.md           # RabbitMQ conceptual design (topic exchange nexus.hr)
│   └── grpc/
│       └── employees.proto         # proto3 service definitions (EmployeeService, DepartmentService)
│
├── scripts/                        # Seed scripts for demo data
├── nginx/
│   └── nginx.conf                  # Upstream blocks + proxy config
├── docker-compose.yml
├── .env.example                    # Template for production secrets
└── README.md
```

---

## Prerequisites

**Docker (recommended)** — only requirement for running via `docker compose`:

| Tool | Version |
|---|---|
| Docker Desktop | 4.x+ |

**Manual (without Docker):**

| Tool | Version |
|---|---|
| Node.js | v18+ (v22 recommended) |
| PostgreSQL | v14+ |
| MongoDB | v6+ |
| Redis | v7+ |

---

## Environment Variables

For Docker, secrets can be overridden via a root `.env` file (template at `.env.example`):

```bash
cp .env.example .env   # then edit .env with real values
```

| Variable | Default (dev) | Description |
|---|---|---|
| `JWT_SECRET` | `nexus_jwt_secret_change_in_production` | Signs all JWTs — **must change in production** |
| `DB_PASS` | `password` | PostgreSQL password |
| `POSTGRES_PASSWORD` | `password` | PostgreSQL root password |

### Per-service variables (set in docker-compose.yml)

**auth-service:**

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://mongo:27017/nexus_auth` | MongoDB connection string |
| `JWT_SECRET` | _(from root .env)_ | JWT signing secret |
| `PORT` | `3001` | Service port |

**employee-service:**

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `nexus_hr` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASS` | _(from root .env)_ | Database password |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `PORT` | `3002` | Service port |

**time-tracking-service:**

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://mongo:27017/nexus_payroll` | MongoDB connection string |
| `PORT` | `3005` | Service port |

> `.env` files are in `.gitignore` — never commit them.

---

## Running the Project

### Docker (recommended)

```bash
docker compose up --build
```

| URL | Description |
|---|---|
| http://localhost | App (via Nginx) |
| http://localhost:8080/api/docs | Swagger UI (OpenAPI 3.0) |
| http://localhost:8080/health | Gateway health check |
| http://localhost:8080/api/registry | Service registry |

### Manual (development)

Open 5 terminals:

```bash
# Terminal 1 — Auth Service
cd auth-service && npm run dev

# Terminal 2 — Employee Service
cd employee-service && npm run dev

# Terminal 3 — Time-Tracking Service
cd time-tracking-service && npm run dev

# Terminal 4 — API Gateway
cd api-gateway && npm run dev

# Terminal 5 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Reference

All requests go through the **API Gateway**. Versioned routes are preferred; legacy aliases also work.

> Full interactive docs available at **http://localhost:8080/api/docs**

### Auth — `/api/v1/auth` (or `/api/auth`)

#### `POST /api/auth/register`
```json
// Request
{ "username": "jdoe", "email": "jdoe@nexushr.com", "password": "secret123" }

// Response 201
{ "token": "<15m JWT>", "refreshToken": "<7d token>", "user": { "id": "...", "username": "jdoe", "role": "employee" } }
```

#### `POST /api/auth/login`
```json
// Request
{ "email": "jdoe@nexushr.com", "password": "secret123" }

// Response 200
{ "token": "<15m JWT>", "refreshToken": "<7d token>", "user": { ... } }
```

#### `POST /api/auth/refresh`
```json
// Request
{ "refreshToken": "<token>" }

// Response 200
{ "token": "<new 15m JWT>" }
```

#### `POST /api/auth/logout`
```json
// Request
{ "refreshToken": "<token>" }

// Response 200
{ "message": "Logged out successfully" }
```

---

### Employees — `/api/v1/employees` (or `/api/employees`)

All endpoints require `Authorization: Bearer <token>`. Responses include `_links` (HATEOAS).

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/employees` | any | List all employees (Redis cached 30s) |
| `GET` | `/employees/me` | any | Current user's employee record |
| `PUT` | `/employees/me` | any | Update own phone number |
| `GET` | `/employees/:id` | any | Single employee |
| `POST` | `/employees` | admin | Create employee |
| `PUT` | `/employees/:id` | admin, manager | Update employee (managers: subordinates only, no salary) |
| `DELETE` | `/employees/:id` | admin | Delete employee |

**Sample response with HATEOAS:**
```json
{
  "id": 1,
  "firstName": "Carol",
  "lastName": "White",
  "email": "carol@nexushr.com",
  "position": "Senior Software Engineer",
  "status": "active",
  "salary": 85000,
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

### Departments — `/api/v1/departments` (or `/api/departments`)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/departments` | any | List all departments with headcount (Redis cached 30s) |
| `POST` | `/departments` | admin | Create department |
| `DELETE` | `/departments/:id` | admin | Delete department (blocked if employees assigned) |

---

### Payroll — `/api/v1/payroll` (or `/api/payroll`)

#### `POST /api/payroll/calculate`
Requires authentication (JWT forwarded by gateway).

```json
// Request
{ "employeeName": "Carol White", "role": "Engineer", "hourlyRate": 45, "hoursWorked": 160 }

// Response 200
{
  "header": { "company": "NEXUS HR SOLUTIONS", "report_type": "Monthly Payroll Statement", "date": "..." },
  "employee_profile": { "full_name": "Carol White", "position": "Engineer" },
  "financial_summary": {
    "hours_logged": "160 hrs",
    "rate_per_hour": "45 €",
    "gross_total": "7200.00 €",
    "deductions": "720.00 € (Tax 10%)",
    "final_net_salary": "6480.00 €"
  },
  "status": "VERIFIED"
}
```

---

### Gateway Utilities

| Path | Description |
|---|---|
| `GET /health` | Gateway liveness check |
| `GET /api/registry` | Lists all registered microservices |
| `GET /api/docs` | Swagger UI |
| `GET /api/docs.json` | Raw OpenAPI 3.0 JSON |

All responses include the `X-API-Version: 1.0` header.

---

## Authentication Flow

```
1. User submits login form
        │
        ▼
2. Frontend POSTs credentials → API Gateway → Auth Service
        │
        ▼
3. Auth Service verifies password with bcrypt
        │
        ▼
4. Returns: access token (15 min JWT) + refresh token (7 days, stored in MongoDB)
        │
        ▼
5. Zustand store (persisted to localStorage) holds user, token, refreshToken
        │
        ▼
6. Every request: Axios interceptor attaches  Authorization: Bearer <token>
        │
        ▼
7. API Gateway verifies JWT → injects X-User-Role + X-User-Email headers
        │
        ▼
8. On 401: interceptor silently calls POST /api/auth/refresh,
          updates Zustand store + localStorage, retries original request once
        │
        ▼
9. On refresh failure: store cleared → redirect to /login
```

---

## Database Models

### MongoDB — User (`auth-service`)

| Field | Type | Constraints |
|---|---|---|
| `username` | String | required, unique, trimmed |
| `email` | String | required, unique, lowercase |
| `password` | String | required, bcrypt hashed |
| `role` | String | enum: admin/manager/employee, default: employee |
| `createdAt` | Date | auto |

### MongoDB — RefreshToken (`auth-service`)

| Field | Type | Constraints |
|---|---|---|
| `token` | String | required, unique |
| `userId` | ObjectId | ref: User |
| `expiresAt` | Date | required — checked on every refresh |

### PostgreSQL — Employee (`employee-service`)

| Field | Type | Constraints |
|---|---|---|
| `id` | Integer | PK, auto-increment |
| `firstName` | String | not null |
| `lastName` | String | not null |
| `email` | String | not null, unique |
| `phone` | String | nullable |
| `position` | String | nullable |
| `status` | Enum | active / inactive / on_leave, default: active |
| `hireDate` | Date | CHECK: ≤ today |
| `salary` | Decimal | CHECK: ≥ 0 |
| `departmentId` | Integer | FK → Departments (SET NULL on delete) |
| `managerId` | Integer | FK → Employees self-reference (SET NULL on delete) |

Indexes: `departmentId`, `managerId`, `status`, `hireDate`, `(lastName, firstName)`.

### PostgreSQL — Department (`employee-service`)

| Field | Type | Constraints |
|---|---|---|
| `id` | Integer | PK, auto-increment |
| `name` | String | not null, unique |

### PostgreSQL — employee_audit_log

Populated automatically by the `trg_employee_audit` trigger on every `UPDATE` to `Employees` that changes `status` or `salary`.

| Field | Type | Description |
|---|---|---|
| `id` | Serial | PK |
| `employee_id` | Integer | References Employees |
| `field_name` | Varchar | e.g. `status`, `salary` |
| `old_value` | Text | Previous value |
| `new_value` | Text | New value |
| `changed_at` | Timestamptz | Auto-set |

**Stored procedure:** `get_department_stats()` — returns `(dept_name, headcount, avg_salary)` per department.

---

## Testing

```bash
# Auth Service — 15 integration tests (Jest + Supertest, models mocked)
cd auth-service && npm test

# Employee Service — 13 integration tests (Jest + Supertest + SQLite in-memory)
cd employee-service && npm test
```

Tests cover: registration (valid/duplicate/invalid), login (correct/wrong password/missing fields), token refresh (valid/expired/missing), logout, and full employee + department CRUD with role-based access checks.
