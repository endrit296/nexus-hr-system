"""
Nexus HR System — Locust Performance Test
==========================================
Simulates 1 000+ concurrent users hitting the API Gateway.

Usage:
    pip install locust
    locust -f tests/performance/locustfile.py \
           --host http://localhost:8080 \
           --users 1000 \
           --spawn-rate 50 \
           --run-time 2m \
           --headless \
           --html tests/performance/report.html

Or open the Locust web UI:
    locust -f tests/performance/locustfile.py --host http://localhost:8080
    Then visit http://localhost:8089
"""

import random
import json
from locust import HttpUser, task, between, events

# ── Credentials ───────────────────────────────────────────────────────────────
ADMIN_EMAIL    = "admin@nexus.com"
ADMIN_PASSWORD = "password123"


# ── Helper ────────────────────────────────────────────────────────────────────
def get_token(client):
    """Login and return the access token, or None on failure."""
    resp = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        name="/api/auth/login [setup]",
        catch_response=True,
    )
    if resp.status_code == 200:
        resp.success()
        return resp.json().get("accessToken")
    resp.failure(f"Login failed: {resp.status_code}")
    return None


# ── Primary user behaviour ────────────────────────────────────────────────────
class NexusHRUser(HttpUser):
    """
    Simulates a typical HR platform user:
      - reads dominate (employees / departments / payroll)
      - occasional writes (create employee, calculate salary)
    """

    wait_time = between(0.5, 2.0)   # think-time between tasks (seconds)

    def on_start(self):
        """Authenticate once per simulated user at the start of the session."""
        self.token = get_token(self.client)
        self.auth  = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.employee_ids = []

    # ── Auth (weight 1) ────────────────────────────────────────────────────────
    @task(1)
    def health_check(self):
        self.client.get("/health", name="/health")

    # ── Employees (weight 5) ───────────────────────────────────────────────────
    @task(5)
    def list_employees(self):
        page  = random.randint(1, 3)
        limit = random.choice([10, 20, 50])
        with self.client.get(
            f"/api/employees?page={page}&limit={limit}",
            headers=self.auth,
            name="/api/employees [list]",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                ids  = [e["id"] for e in data.get("employees", []) if "id" in e]
                if ids:
                    self.employee_ids = ids
                resp.success()
            else:
                resp.failure(f"status {resp.status_code}")

    @task(3)
    def get_employee(self):
        if not self.employee_ids:
            return
        emp_id = random.choice(self.employee_ids)
        with self.client.get(
            f"/api/employees/{emp_id}",
            headers=self.auth,
            name="/api/employees/:id [get]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"status {resp.status_code}")

    @task(2)
    def search_employees(self):
        terms = ["a", "e", "i", "o"]
        q     = random.choice(terms)
        self.client.get(
            f"/api/employees?search={q}&page=1&limit=10",
            headers=self.auth,
            name="/api/employees [search]",
        )

    @task(1)
    def filter_by_status(self):
        status = random.choice(["active", "inactive", "on_leave"])
        self.client.get(
            f"/api/employees?status={status}&page=1&limit=20",
            headers=self.auth,
            name="/api/employees [filter-status]",
        )

    # ── Departments (weight 4) ─────────────────────────────────────────────────
    @task(4)
    def list_departments(self):
        self.client.get(
            "/api/departments",
            headers=self.auth,
            name="/api/departments [list]",
        )

    # ── Payroll (weight 3) ─────────────────────────────────────────────────────
    @task(3)
    def calculate_salary(self):
        hourly_rate  = round(random.uniform(15, 80), 2)
        hours_worked = random.choice([80, 120, 160, 176])
        self.client.post(
            "/api/payroll/calculate",
            headers={**self.auth, "Content-Type": "application/json"},
            json={
                "employeeName": f"Locust User {random.randint(1, 9999)}",
                "role":         "Test Role",
                "hourlyRate":   hourly_rate,
                "hoursWorked":  hours_worked,
            },
            name="/api/payroll/calculate",
        )

    # ── Service Registry (weight 1) ────────────────────────────────────────────
    @task(1)
    def registry(self):
        self.client.get("/api/registry", name="/api/registry")


# ── Admin-only behaviour (heavier write load) ─────────────────────────────────
class AdminUser(NexusHRUser):
    """
    Inherits the read tasks and adds write operations.
    Spawned at ~10% ratio: use --class-picker in Locust UI, or add weight below.
    """

    weight = 1   # 1 AdminUser per 10 NexusHRUsers (weight ratio)

    @task(1)
    def create_employee(self):
        ts   = random.randint(100_000, 999_999)
        resp = self.client.post(
            "/api/employees",
            headers={**self.auth, "Content-Type": "application/json"},
            json={
                "firstName": "Locust",
                "lastName":  f"Bot{ts}",
                "email":     f"locust.bot{ts}@perf.test",
                "position":  "Load Tester",
                "hireDate":  "2024-06-01",
                "salary":    50000,
            },
            name="/api/employees [create]",
        )
        if resp.status_code == 201:
            emp_id = resp.json().get("id")
            if emp_id:
                self.employee_ids.append(emp_id)

    @task(1)
    def audit_logs(self):
        self.client.get(
            "/api/auth/audit-logs?page=1&limit=20",
            headers=self.auth,
            name="/api/auth/audit-logs",
        )


# ── Event hooks (printed at end of run) ───────────────────────────────────────
@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    stats = environment.stats
    print("\n── Locust Summary ────────────────────────────────────────────")
    print(f"  Total requests : {stats.total.num_requests}")
    print(f"  Total failures : {stats.total.num_failures}")
    if stats.total.num_requests:
        fail_pct = 100 * stats.total.num_failures / stats.total.num_requests
        print(f"  Failure rate   : {fail_pct:.2f}%")
    print(f"  Avg response   : {stats.total.avg_response_time:.0f} ms")
    print(f"  95th pct       : {stats.total.get_response_time_percentile(0.95):.0f} ms")
    print("──────────────────────────────────────────────────────────────\n")
