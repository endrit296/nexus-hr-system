# Nexus HR System

A web-based Human Resources management platform built with a **microservices architecture**. Each concern is isolated into its own service — authentication, employee data, and an API Gateway that acts as the single entry point for all client requests.

## Quick Start (Docker)

```bash
docker compose up --build
```

Open **http://localhost** in your browser.

---

## Demo Accounts

All demo accounts use the password: **`Password123`**

| Role | Email | Name | Position |
|---|---|---|---|
| **admin** | alice@nexushr.com | Alice Johnson | CEO |
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
| View departments | ✅ | ✅ | ✅ |
| Edit direct subordinates | ❌ | ✅ | ✅ |
| View / edit salary | ❌ | ❌ | ✅ |
| Add / delete employees | ❌ | ❌ | ✅ |
| Add / delete departments | ❌ | ❌ | ✅ |
| User Management (assign roles) | ❌ | ❌ | ✅ |

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
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Reference](#api-reference)
- [Authentication Flow](#authentication-flow)
- [Database Models](#database-models)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                             │
│              http://localhost:5173                      │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP (Axios)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                           │
│                  localhost:8080                         │
│                                                         │
│   /api/auth/*  ──────────────►  Auth Service :3001      │
│   /api/employees/*  ─────────►  Employee Service :3002  │
└─────────────────────────────────────────────────────────┘
          │                               │
          ▼                               ▼
  ┌───────────────┐               ┌───────────────┐
  │  Auth Service │               │Employee Service│
  │  Port 3001    │               │  Port 3002     │
  │  Node/Express │               │  Node/Express  │
  └───────┬───────┘               └───────┬────────┘
          │                               │
          ▼                               ▼
  ┌───────────────┐               ┌───────────────┐
  │   MongoDB     │               │  PostgreSQL    │
  │   Port 27017  │               │  Port 5432     │
  │  nexus_auth   │               │   nexus_hr     │
  └───────────────┘               └───────────────┘
```

**Key design decisions:**
- The frontend only ever talks to the **API Gateway** — it never calls services directly
- The gateway uses **http-proxy-middleware** to forward requests; it does not parse request bodies
- Each service is **stateless** — no session state in memory; auth is handled via JWT
- Both databases are managed independently — MongoDB for flexible auth documents, PostgreSQL for structured employee records

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | UI, fast dev server |
| HTTP Client | Axios | API calls from frontend |
| API Gateway | Express + http-proxy-middleware | Single entry point, request routing |
| Auth Service | Express + Mongoose + bcryptjs + jsonwebtoken | User registration, login, JWT |
| Employee Service | Express + Sequelize + Joi | Employee CRUD, input validation |
| Auth Database | MongoDB | NoSQL document store for users |
| Employee Database | PostgreSQL | Relational store for employee records |
| Runtime | Node.js v22+ | All backend services |

---

## Project Structure

```
nexus-hr-system/
│
├── api-gateway/                  # Entry point for all client requests (port 8080)
│   ├── index.js                  # Proxy routes + health check
│   └── package.json
│
├── auth-service/                 # Handles registration, login, JWT (port 3001)
│   ├── index.js                  # Mounts /auth routes
│   ├── db.js                     # MongoDB connection
│   ├── models/
│   │   └── User.js               # Mongoose schema: username, email, password
│   ├── routes/
│   │   └── auth.js               # POST /auth/register, POST /auth/login
│   ├── .env.example
│   └── package.json
│
├── employee-service/             # Full employee CRUD (port 3002)
│   ├── index.js                  # Connects DB, syncs table, mounts routes
│   ├── config/
│   │   └── database.js           # Sequelize + PostgreSQL connection
│   ├── models/
│   │   └── Employee.js           # Sequelize model: firstName, lastName, email, department
│   ├── routes/
│   │   └── employee.js           # GET/POST/PUT/DELETE /employees
│   ├── .env.example
│   └── package.json
│
├── frontend/                     # React + Vite app (port 5173)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js         # Axios instance, JWT interceptor
│   │   ├── components/
│   │   │   ├── Login.jsx          # Login form → calls /api/auth/login
│   │   │   ├── Login.css
│   │   │   ├── EmployeeList.jsx   # Dashboard, fetches /api/employees
│   │   │   ├── EmployeeList.css
│   │   │   ├── SystemInfo.jsx     # System info card
│   │   │   └── SystemInfo.css
│   │   ├── App.jsx               # Auth state, routes between Login / Dashboard
│   │   ├── main.jsx              # React entry point
│   │   └── index.css             # Global styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## Prerequisites

Make sure the following are installed on your machine before starting:

| Requirement | Version | Download |
|---|---|---|
| Node.js | v18+ (v22 recommended) | https://nodejs.org |
| PostgreSQL | v14+ | https://www.postgresql.org/download/windows/ |
| MongoDB | v6+ | https://www.mongodb.com/try/download/community |

**PostgreSQL setup** — after installing, create the database:
```bash
psql -U postgres -c "CREATE DATABASE nexus_hr;"
```

**MongoDB** — if installed as a service (default), it starts automatically. No database creation needed — Mongoose creates it on first connection.

---

## Setup & Installation

Clone the repo and install dependencies for each service:

```bash
# API Gateway
cd api-gateway && npm install

# Auth Service
cd ../auth-service && npm install

# Employee Service
cd ../employee-service && npm install

# Frontend
cd ../frontend && npm install
```

---

## Environment Variables

Each service reads configuration from a `.env` file. Copy the provided example and fill in your values:

```bash
cp auth-service/.env.example     auth-service/.env
cp employee-service/.env.example employee-service/.env
```

### auth-service/.env

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/nexus_auth` | MongoDB connection string |
| `JWT_SECRET` | `nexus_jwt_secret_change_in_production` | Secret used to sign JWTs — **change this** |
| `PORT` | `3001` | Port the service listens on |

### employee-service/.env

| Variable | Default | Description |
|---|---|---|
| `DB_NAME` | `nexus_hr` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASS` | `password` | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `PORT` | `3002` | Port the service listens on |

> `.env` files are in `.gitignore` — never commit them.

---

## Running the Project

Open **4 terminals** and run one command per terminal. Start the services before the frontend:

```bash
# Terminal 1 — Auth Service
cd auth-service && npm run dev

# Terminal 2 — Employee Service
cd employee-service && npm run dev

# Terminal 3 — API Gateway
cd api-gateway && npm run dev

# Terminal 4 — Frontend
cd frontend && npm run dev
```

Expected output per terminal:

| Service | Success message |
|---|---|
| Auth Service | `MongoDB connected successfully` → `Auth Service running on http://localhost:3001` |
| Employee Service | `PostgreSQL connected successfully` → `Employee table synced` → `Employee Service running on http://localhost:3002` |
| API Gateway | `API Gateway running on http://localhost:8080` |
| Frontend | `Local: http://localhost:5173` |

Open **http://localhost:5173** in your browser.

### First-time: create your account

The UI only has a login form. Register your first user via the API directly:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@nexushr.com","password":"password123"}'
```

Then log in through the browser at http://localhost:5173.

---

## API Reference

All requests go through the **API Gateway on port 8080**.

### Auth — `/api/auth`

#### `POST /api/auth/register`
Register a new user.

**Request body:**
```json
{
  "username": "admin",
  "email": "admin@nexushr.com",
  "password": "password123"
}
```

**Response `201`:**
```json
{
  "message": "User registered successfully",
  "token": "<jwt>",
  "user": { "id": "...", "username": "admin", "email": "admin@nexushr.com" }
}
```

---

#### `POST /api/auth/login`
Log in with an existing account.

**Request body:**
```json
{
  "email": "admin@nexushr.com",
  "password": "password123"
}
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": { "id": "...", "username": "admin", "email": "admin@nexushr.com" }
}
```

---

### Employees — `/api/employees`

#### `GET /api/employees`
Returns all employees.

**Response `200`:**
```json
{
  "status": "ok",
  "employees": [
    { "id": 1, "firstName": "Arber", "lastName": "Krasniqi", "email": "arber@nexushr.com", "department": "Engineering" }
  ]
}
```

---

#### `GET /api/employees/:id`
Returns a single employee by ID.

---

#### `POST /api/employees`
Create a new employee.

**Request body:**
```json
{
  "firstName": "Arber",
  "lastName": "Krasniqi",
  "email": "arber@nexushr.com",
  "department": "Engineering"
}
```

**Response `201`:** The created employee object.

---

#### `PUT /api/employees/:id`
Update an employee. All fields are optional.

**Request body (partial update):**
```json
{
  "department": "HR"
}
```

**Response `200`:** The updated employee object.

---

#### `DELETE /api/employees/:id`
Delete an employee.

**Response `200`:**
```json
{ "message": "Employee deleted successfully" }
```

---

### Gateway

#### `GET /health`
Returns gateway status.
```json
{ "status": "ok", "service": "api-gateway", "timestamp": "..." }
```

---

## Authentication Flow

```
1. User submits login form
        │
        ▼
2. Frontend POSTs credentials to /api/auth/login via API Gateway
        │
        ▼
3. Auth Service verifies password with bcrypt
        │
        ▼
4. Auth Service returns a signed JWT (expires in 24h)
        │
        ▼
5. Frontend stores JWT in localStorage
        │
        ▼
6. All subsequent requests include:
   Authorization: Bearer <token>
   (added automatically by the Axios interceptor in src/api/client.js)
```

> **Note:** The API Gateway currently proxies all requests without validating the JWT itself. Token validation happens inside each service. A shared auth middleware can be added to the gateway in a future phase.

---

## Database Models

### MongoDB — User (`auth-service`)

| Field | Type | Constraints |
|---|---|---|
| `username` | String | required, unique, trimmed |
| `email` | String | required, unique, lowercase |
| `password` | String | required, bcrypt hashed |
| `createdAt` | Date | auto-set on create |

### PostgreSQL — Employee (`employee-service`)

| Field | Type | Constraints |
|---|---|---|
| `id` | Integer | auto-increment, primary key |
| `firstName` | String | not null |
| `lastName` | String | not null |
| `email` | String | not null, unique |
| `department` | String | default: `'General'` |
| `createdAt` | Date | auto-managed by Sequelize |
| `updatedAt` | Date | auto-managed by Sequelize |

> The `Employees` table is created automatically on first startup via `sequelize.sync({ alter: true })`. No manual migrations needed during development.
