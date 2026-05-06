"""
Nexus HR System — Locust Performance Test Suite
================================================
Simulates 1 000+ concurrent users across three user roles.

Run headless (1 000 users, 50 spawn/sec, 3-minute run):
    locust -f tests/performance/locustfile.py \
           --headless -u 1000 -r 50 \
           --run-time 3m \
           --host http://localhost \
           --html tests/performance/report.html \
           --csv  tests/performance/results

Run with web UI (visit http://localhost:8089):
    locust -f tests/performance/locustfile.py --host http://localhost

Acceptance thresholds (Faza 3):
    p95 response time  < 500 ms
    Error rate         < 1 %
    Throughput @1000u  > 200 req/s
"""

import random
import string
from locust import HttpUser, TaskSet, task, between, events
from locust.exception import RescheduleTask

# ── Shared state populated during on_test_start ───────────────────────────────
_admin_token: str = ""
_employee_ids: list = []
_department_ids: list = []

ADMIN_EMAIL    = "admin@nexushr.com"
ADMIN_PASSWORD = "Admin1234!"


def _rnd_str(n: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase, k=n))


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Pre-warm shared state before the swarm starts."""
    global _admin_token, _employee_ids, _department_ids

    host = environment.host or "http://localhost"

    # Use a raw requests session so we don't need a full HttpUser here
    import requests
    session = requests.Session()

    resp = session.post(
        f"{host}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    if resp.status_code == 200:
        _admin_token = resp.json().get("token", "")
        print(f"[setup] admin login OK, token={'set' if _admin_token else 'MISSING'}")
    else:
        print(f"[setup] WARNING: admin login failed ({resp.status_code}): {resp.text[:200]}")
        return

    hdrs = {"Authorization": f"Bearer {_admin_token}"}

    emp_r = session.get(f"{host}/api/employees?limit=50", headers=hdrs, timeout=10)
    if emp_r.status_code == 200:
        _employee_ids = [e["id"] for e in emp_r.json().get("employees", [])]

    dept_r = session.get(f"{host}/api/departments", headers=hdrs, timeout=10)
    if dept_r.status_code == 200:
        _department_ids = [d["id"] for d in dept_r.json().get("departments", [])]

    print(
        f"[setup] employees={len(_employee_ids)}, departments={len(_department_ids)}"
    )


# ── Task sets ─────────────────────────────────────────────────────────────────

class PublicTasks(TaskSet):
    """Unauthenticated traffic — health checks and login."""

    @task(3)
    def health_check(self):
        self.client.get("/health", name="GET /health")

    @task(2)
    def login_valid(self):
        with self.client.post(
            "/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            name="POST /auth/login (valid)",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 429):
                r.failure(f"unexpected {r.status_code}")

    @task(1)
    def login_invalid(self):
        with self.client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
            name="POST /auth/login (invalid)",
            catch_response=True,
        ) as r:
            if r.status_code in (401, 429):
                r.success()
            else:
                r.failure(f"expected 401, got {r.status_code}")


class ReadTasks(TaskSet):
    """Read-heavy tasks — the majority of HR platform traffic."""

    def on_start(self):
        self._hdrs = {"Authorization": f"Bearer {_admin_token}"}

    @task(5)
    def list_employees(self):
        page = random.randint(1, 3)
        with self.client.get(
            f"/api/employees?page={page}&limit=20",
            headers=self._hdrs,
            name="GET /employees",
            catch_response=True,
        ) as r:
            if r.status_code == 401:
                raise RescheduleTask()
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")

    @task(3)
    def get_employee(self):
        if not _employee_ids:
            return
        eid = random.choice(_employee_ids)
        with self.client.get(
            f"/api/employees/{eid}",
            headers=self._hdrs,
            name="GET /employees/:id",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304, 404):
                r.failure(f"status={r.status_code}")

    @task(3)
    def list_departments(self):
        with self.client.get(
            "/api/departments",
            headers=self._hdrs,
            name="GET /departments",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")

    @task(2)
    def search_employees(self):
        q = random.choice(["alice", "bob", "eng", "hr", "man"])
        with self.client.get(
            f"/api/employees?search={q}",
            headers=self._hdrs,
            name="GET /employees?search=",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")

    @task(2)
    def filter_by_status(self):
        s = random.choice(["active", "on_leave", "inactive"])
        with self.client.get(
            f"/api/employees?status={s}",
            headers=self._hdrs,
            name="GET /employees?status=",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")

    @task(1)
    def get_my_profile(self):
        with self.client.get(
            "/api/employees/me",
            headers=self._hdrs,
            name="GET /employees/me",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304, 404):
                r.failure(f"status={r.status_code}")

    @task(1)
    def time_logs(self):
        if not _employee_ids:
            return
        eid = random.choice(_employee_ids)
        with self.client.get(
            f"/api/v1/payroll/time/my?employeeId={eid}",
            headers=self._hdrs,
            name="GET /payroll/time/my",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304, 403, 404):
                r.failure(f"status={r.status_code}")

    @task(1)
    def payroll_report(self):
        if not _employee_ids:
            return
        eid = random.choice(_employee_ids)
        rate = round(random.uniform(15, 80), 2)
        hours = random.choice([80, 120, 160, 176])
        with self.client.get(
            f"/api/v1/payroll/employee/{eid}?hourlyRate={rate}&hoursWorked={hours}",
            headers=self._hdrs,
            name="GET /payroll/employee/:id",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304, 403, 404):
                r.failure(f"status={r.status_code}")


class WriteTasks(TaskSet):
    """Write operations — admin mutations."""

    def on_start(self):
        self._hdrs = {"Authorization": f"Bearer {_admin_token}"}
        self._created: list = []

    @task(3)
    def list_employees(self):
        with self.client.get(
            "/api/employees?page=1&limit=20",
            headers=self._hdrs,
            name="GET /employees (admin)",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")

    @task(2)
    def update_employee_status(self):
        if not _employee_ids:
            return
        eid = random.choice(_employee_ids)
        # Fetch current state first
        gr = self.client.get(
            f"/api/employees/{eid}",
            headers=self._hdrs,
            name="GET /employees/:id (pre-write)",
        )
        if gr.status_code != 200:
            return
        emp = gr.json()
        new_status = random.choice(["active", "on_leave", "inactive"])
        with self.client.put(
            f"/api/employees/{eid}",
            json={
                "firstName":    emp.get("firstName", "Perf"),
                "lastName":     emp.get("lastName", "Test"),
                "email":        emp.get("email", f"perf{eid}@test.com"),
                "status":       new_status,
                "phone":        emp.get("phone"),
                "position":     emp.get("position"),
                "hireDate":     emp.get("hireDate"),
                "salary":       emp.get("salary"),
                "hourlyRate":   emp.get("hourlyRate"),
                "departmentId": emp.get("departmentId"),
                "managerId":    emp.get("managerId"),
            },
            headers=self._hdrs,
            name="PUT /employees/:id",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 409, 429):
                r.failure(f"status={r.status_code}")

    @task(1)
    def audit_logs(self):
        with self.client.get(
            "/api/auth/audit-logs?limit=20",
            headers=self._hdrs,
            name="GET /auth/audit-logs",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")

    @task(1)
    def list_users(self):
        with self.client.get(
            "/api/auth/users?limit=20",
            headers=self._hdrs,
            name="GET /auth/users",
            catch_response=True,
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f"status={r.status_code}")


# ── User classes (weight = proportion of simulated population) ────────────────

class AnonymousUser(HttpUser):
    """20 % — unauthenticated traffic (health probes, login)."""
    tasks = [PublicTasks]
    wait_time = between(1, 3)
    weight = 20


class RegularEmployee(HttpUser):
    """60 % — authenticated read-heavy employees."""
    tasks = [ReadTasks]
    wait_time = between(1, 4)
    weight = 60


class AdminUser(HttpUser):
    """20 % — admin write operations."""
    tasks = [WriteTasks]
    wait_time = between(2, 6)
    weight = 20


# ── Summary hook ─────────────────────────────────────────────────────────────

@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    s = environment.stats.total
    print("\n── Nexus HR Performance Summary ───────────────────────────────")
    print(f"  Requests      : {s.num_requests}")
    print(f"  Failures      : {s.num_failures}")
    if s.num_requests:
        print(f"  Failure rate  : {100*s.num_failures/s.num_requests:.2f}%")
    print(f"  Avg response  : {s.avg_response_time:.0f} ms")
    print(f"  p95 response  : {s.get_response_time_percentile(0.95):.0f} ms")
    print(f"  Throughput    : {s.total_rps:.1f} req/s")
    print("───────────────────────────────────────────────────────────────\n")
