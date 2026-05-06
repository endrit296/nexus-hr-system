# Performance Testing — Locust

## Prerequisites

```bash
pip install locust
```

## Run headless (1 000 users, 50 spawn/sec, 3-minute run)

```bash
locust -f tests/performance/locustfile.py \
       --headless -u 1000 -r 50 \
       --run-time 3m \
       --host http://localhost \
       --html tests/performance/report.html \
       --csv  tests/performance/results
```

## Run with web UI (open http://localhost:8089)

```bash
locust -f tests/performance/locustfile.py --host http://localhost
```

## User distribution

| Class | Weight | Behaviour |
|---|---|---|
| `AnonymousUser` | 20 % | Health checks + login attempts |
| `RegularEmployee` | 60 % | List/search employees, read time logs |
| `AdminUser` | 20 % | Paginated lists, status updates, audit logs |

## Acceptance thresholds (Faza 3)

| Metric | Target |
|---|---|
| p95 response time | < 500 ms |
| Error rate | < 1 % |
| Throughput at 1 000 users | > 200 req/s |

## CI integration

Add to `.github/workflows/ci.yml` for automated load runs:

```yaml
- name: Performance test (smoke — 50 users)
  run: |
    pip install locust
    locust -f tests/performance/locustfile.py \
           --headless -u 50 -r 10 --run-time 30s \
           --host http://localhost \
           --csv tests/performance/ci-results \
           --exit-code-on-error 1
```
