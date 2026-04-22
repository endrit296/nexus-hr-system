-- =============================================================================
-- Nexus HR System — PostgreSQL DDL
-- Database: nexus_hr
-- Generated from: employee-service Sequelize models + live DB
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DEPARTMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Departments" (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Composite covering index: name is already unique-indexed; add for ORDER BY patterns
CREATE INDEX IF NOT EXISTS idx_departments_name ON "Departments" (name ASC);
-- Justification: GET /departments sorts by name ASC — avoids full-table sort on large datasets.

-- -----------------------------------------------------------------------------
-- EMPLOYEES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Employees" (
  id             SERIAL PRIMARY KEY,
  "firstName"    VARCHAR(255) NOT NULL,
  "lastName"     VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  phone          VARCHAR(255),
  position       VARCHAR(255),
  status         VARCHAR(20)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'on_leave')),
  "hireDate"     DATE         CHECK ("hireDate" IS NULL OR "hireDate" <= CURRENT_DATE),
  salary         DECIMAL(10,2) CHECK (salary IS NULL OR salary >= 0),
  "departmentId" INTEGER      REFERENCES "Departments"(id) ON DELETE SET NULL,
  "managerId"    INTEGER      REFERENCES "Employees"(id)   ON DELETE SET NULL,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Individual indexes
CREATE INDEX IF NOT EXISTS idx_employees_department ON "Employees" ("departmentId");
-- Justification: Every JOIN to Department filters on departmentId; critical for org chart queries.

CREATE INDEX IF NOT EXISTS idx_employees_manager ON "Employees" ("managerId");
-- Justification: Self-join on managerId is used for hierarchy building in org chart.

CREATE INDEX IF NOT EXISTS idx_employees_status ON "Employees" (status);
-- Justification: Dashboard stat cards filter by status (active / on_leave count).

CREATE INDEX IF NOT EXISTS idx_employees_hiredate ON "Employees" ("hireDate");
-- Justification: Monthly hire trend chart groups/sorts by hireDate.

-- Composite index for name search
CREATE INDEX IF NOT EXISTS idx_employees_name ON "Employees" ("lastName", "firstName");
-- Justification: Employee directory search filters by last name first; composite avoids index merge.

-- -----------------------------------------------------------------------------
-- AUDIT LOG
-- Captures every status and salary change at the DB layer so no app-level code
-- can bypass the audit trail. Stored at DB level because any client (Sequelize,
-- raw SQL, migrations) that touches Employees is automatically covered.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_audit_log (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER      NOT NULL,
  field_name   VARCHAR(100) NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_employee ON employee_audit_log (employee_id, changed_at DESC);
-- Justification: Audit history queries are always scoped to one employee, sorted by recency.

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION — log_employee_changes
-- Why DB-level: Any UPDATE path (Sequelize hooks, direct psql, migrations) is
-- covered automatically. No risk of audit trail being skipped by app-layer bugs.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_employee_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO employee_audit_log (employee_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'status', OLD.status, NEW.status);
  END IF;
  IF OLD.salary IS DISTINCT FROM NEW.salary THEN
    INSERT INTO employee_audit_log (employee_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'salary', OLD.salary::TEXT, NEW.salary::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_audit
  AFTER UPDATE ON "Employees"
  FOR EACH ROW EXECUTE FUNCTION log_employee_changes();

-- -----------------------------------------------------------------------------
-- STORED PROCEDURE — get_department_stats()
-- Why DB-level: Aggregation over a JOIN is cheaper inside the DB engine than
-- pulling all rows to Node.js and computing in-process. Also reusable by any
-- future reporting client without changing app code.
-- Usage: SELECT * FROM get_department_stats();
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_department_stats()
RETURNS TABLE (dept_name VARCHAR, headcount BIGINT, avg_salary NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.name                     AS dept_name,
    COUNT(e.id)                AS headcount,
    ROUND(AVG(e.salary), 2)   AS avg_salary
  FROM "Departments" d
  LEFT JOIN "Employees" e ON e."departmentId" = d.id
  GROUP BY d.name
  ORDER BY headcount DESC;
END;
$$ LANGUAGE plpgsql;
