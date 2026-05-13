# Load Testing — k6

Performance / load tests for the Nexus HR system using [k6](https://k6.io).  
k6 runs as a standalone binary — it is **not** a Node.js package and is not in `package.json`.

## Install k6

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Windows (Chocolatey):**
```powershell
choco install k6
```

**Docker (no install):**
```bash
docker run --rm -i grafana/k6 run - < auth-load.js
```

---

## Scripts

| File | VUs | Duration | Focus |
|------|-----|----------|-------|
| `auth-load.js`  | 50  | 1 min    | Login → protected requests → logout |
| `leave-load.js` | 100 | 2 min    | GET leave-requests + leave-balance   |
| `mixed-load.js` | 0→200 | 5 min  | 70% reads / 20% writes / 10% auth   |

---

## Running locally (docker-compose)

1. Start the stack:
   ```bash
   docker-compose up -d
   ```

2. Seed a load-test user (example with Newman):
   ```bash
   # Or create via the admin UI / API
   curl -X POST http://localhost:8080/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"loadtest","email":"loadtest@nexus.com","password":"loadtest123"}'
   ```

3. Run a script:
   ```bash
   cd tools/load-testing
   BASE_URL=http://localhost:8080 k6 run auth-load.js
   ```

   With custom credentials:
   ```bash
   BASE_URL=http://localhost:8080 \
   TEST_EMAIL=loadtest@nexus.com \
   TEST_PASSWORD=loadtest123 \
   k6 run leave-load.js
   ```

---

## Running against a deployed URL

```bash
BASE_URL=https://your-deployment.example.com \
TEST_EMAIL=loadtest@nexus.com \
TEST_PASSWORD=loadtest123 \
k6 run mixed-load.js
```

---

## Interpreting k6 output

```
✓ login: status 200          [ 100% ] 3000 passes
✗ GET /employees: status 200 [  98% ] 2940 passes / 60 failures

http_req_duration............: avg=87ms   min=12ms   med=62ms   max=1.2s  p(90)=210ms  p(95)=380ms
http_req_failed..............: 0.50%  ✓ 0      ✗ 15
vus..........................: 50     min=1    max=50
```

**Key metrics:**
- `http_req_duration` — response latency. Focus on `p(95)` (the 95th percentile).
- `http_req_failed` — requests that returned a non-2xx status OR a network error.
- `checks` — percentage of custom assertions (defined in `check()`) that passed.

**Thresholds** are defined per script. If any threshold fails, k6 exits with code 99.

---

## Bottlenecks and recommendations

- If `p(95)` latency > 500 ms on auth endpoints: check bcrypt work factor (cost > 10 is slow under load).
- If `http_req_failed` spikes: check rate limiting (the API gateway limits to 200 req/min general).
- If `leave-balance` is slow: add a DB index on `LeaveBalanceLedger(employeeId, leaveTypeId)`.
- If `mixed-load` degrades at 150+ VUs: check Redis cache hit rate and PostgreSQL connection pool size.
