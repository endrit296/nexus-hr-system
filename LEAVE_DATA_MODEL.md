# Leave Management — Data Model

## Tables

Four new tables in the `nexus_hr` PostgreSQL database, owned by `employee-service`.

| Table | Purpose |
|---|---|
| `leave_types` | Catalogue of leave categories (annual, sick) |
| `leave_requests` | Individual leave requests submitted by employees |
| `leave_balance_ledger` | Append-only ledger of balance changes per employee+type |
| `leave_request_audit` | Immutable event log for every state transition on a request |

---

## Why a Ledger Instead of a "Current Balance" Column

A single `current_balance` column on `Employee` would:
- Make corrections require UPDATE (destructive, no history)
- Be vulnerable to concurrent read-modify-write races
- Offer no auditability ("why does this person have 8 days left?")

The ledger approach records every change as a new row with a signed `days` value. Balance is always computed as `SUM(days)` over relevant rows. This means:
- Any balance at any point in time is derivable by filtering `effective_date <= target_date`
- Adjustments and corrections are new rows, never edits
- The full history is preserved forever

---

## Balance Formula

```
available_balance =
    SUM(ledger.days WHERE employee_id = ? AND leave_type_id = ?)
  − reserved_by_open_requests
```

`ledger.days` is signed: accrual rows are positive, consumption rows are negative,
and adjustment rows may be positive or negative. All three entry types are summed
together with no special handling — the sign already encodes the direction of change.

Where:

```
reserved_by_open_requests =
    SUM(working_days_count)
    FROM leave_requests
    WHERE employee_id = ?
      AND leave_type_id = ?
      AND status IN ('pending', 'approved')
      AND NOT EXISTS (
          SELECT 1 FROM leave_balance_ledger
          WHERE related_request_id = leave_requests.id
            AND entry_type = 'consumption'
      )
```

The consumption ledger entry is written only after an approved request has been
fully processed (e.g., at end of day or when the leave period ends). Until that
point, the approved request is "reserved" but not yet debited from the ledger.
This prevents double-counting when computing available days.

---

## Entry Types

| `entry_type` | Sign | When it's written |
|---|---|---|
| `accrual` | Positive | Scheduled grant (e.g., annual allocation on Jan 1, monthly accrual) |
| `consumption` | Negative | After an approved leave period is completed; `related_request_id` points to the request |
| `adjustment` | Positive or Negative | Manual HR correction (carry-over, error fix, penalty) |

---

## Constraints

### Database-level (Sequelize model validators — work in both SQLite and Postgres)

| Constraint | Implementation |
|---|---|
| `end_date >= start_date` | `validate.isAfterOrEqualStart` on `LeaveRequest.endDate` |
| `start_date` and `end_date` in same calendar year | `validate.isSameYear` on `LeaveRequest.endDate` |
| `working_days_count > 0` | `validate.min: 1` on `LeaveRequest.workingDaysCount` |
| `ledger.days != 0` | `validate.notZero` on `LeaveBalanceLedger.days` |

### Application-level hook (enforced before INSERT)

| Constraint | Implementation |
|---|---|
| No two active requests (status IN `pending`, `approved`) with overlapping dates for the same employee | `LeaveRequest.beforeCreate` hook queries for conflicts before inserting |

> **Production note:** For Postgres specifically, this constraint could be hardened to a DB-level `EXCLUDE USING gist` with `daterange` and the `btree_gist` extension. The hook-based approach is correct but could theoretically lose a race between two simultaneous requests. For a single-process Node deployment this is safe; for a multi-replica deployment, adding the exclusion constraint is recommended.

### Soft references (no DB-level FK — cross-database boundary)

`decided_by_user_id`, `created_by_user_id`, and `actor_user_id` store MongoDB ObjectId strings referencing `auth-service.User`. There is no foreign-key constraint because the two services use different databases. These are enforced at the application layer.

---

## Seed Data

Two leave types are seeded idempotently on every `employee-service` startup:

| `code` | `name` | `is_paid` | `requires_proof_after_days` | `max_retroactive_days` |
|---|---|---|---|---|
| `annual` | Annual Leave | true | — | — |
| `sick` | Sick Leave | true | 3 | 7 |

Seed is applied via `LeaveType.findOrCreate` — safe to run multiple times.

---

## Schema

### `leave_types`

```sql
id                       SERIAL PRIMARY KEY
code                     ENUM('annual', 'sick')  NOT NULL UNIQUE
name                     VARCHAR(255)             NOT NULL
is_paid                  BOOLEAN                  NOT NULL DEFAULT true
requires_proof_after_days INTEGER                 NULL
max_retroactive_days      INTEGER                 NULL
created_at               TIMESTAMPTZ              NOT NULL
updated_at               TIMESTAMPTZ              NOT NULL
```

### `leave_requests`

```sql
id                  SERIAL PRIMARY KEY
employee_id         INTEGER  NOT NULL REFERENCES "Employees"(id)
leave_type_id       INTEGER  NOT NULL REFERENCES leave_types(id)
start_date          DATE     NOT NULL
end_date            DATE     NOT NULL  -- CHECK end_date >= start_date (app-level)
                                        -- CHECK YEAR(end_date) = YEAR(start_date) (app-level)
working_days_count  INTEGER  NOT NULL  -- CHECK > 0 (app-level)
status              ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending'
reason              TEXT     NULL
submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
decided_at          TIMESTAMPTZ NULL
decided_by_user_id  VARCHAR(255) NULL   -- soft ref to auth-service User._id
decision_note       TEXT     NULL
withdrawn_at        TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `leave_balance_ledger`

```sql
id                SERIAL PRIMARY KEY
employee_id       INTEGER       NOT NULL REFERENCES "Employees"(id) ON DELETE RESTRICT
leave_type_id     INTEGER       NOT NULL REFERENCES leave_types(id)
entry_type        ENUM('accrual','consumption','adjustment') NOT NULL
days              DECIMAL(5,2)  NOT NULL  -- CHECK != 0 (app-level), positive=credit negative=debit
reason            TEXT          NOT NULL
related_request_id INTEGER      NULL REFERENCES leave_requests(id)
effective_date    DATE          NOT NULL
created_at        TIMESTAMPTZ   NOT NULL
created_by_user_id VARCHAR(255) NOT NULL  -- soft ref to auth-service User._id
```

### `leave_request_audit`

```sql
id              SERIAL PRIMARY KEY
request_id      INTEGER  NOT NULL REFERENCES leave_requests(id)
event_type      ENUM('created','approved','rejected','withdrawn','consumed') NOT NULL
actor_user_id   VARCHAR(255) NOT NULL  -- soft ref to auth-service User._id
payload_json    JSONB    NULL  -- snapshot of relevant state at event time
created_at      TIMESTAMPTZ NOT NULL
```

---

## Carryover and Forfeit (Kosovo Statute)

Kosovo labour law requires employees to use their annual leave by **June 30 of the
following year**. The same rule is applied to sick leave by product requirement.

### Accrual timeline

| When | What is written |
|---|---|
| Hire date | Pro-rated annual allotment + full sick allotment for the hire year |
| Jan 1 each year | Full annual allotment (tenure-based) + 20 sick days |
| Jul 1 each year | Forfeit adjustment (if carryover exists — see below) |

### Forfeit rule

On July 1 the `processYearlyForfeit` job runs for every active employee and each
leave type:

```
allotment        = computeYearlyAccrualAmount(employee, current_year)  // annual
                   20                                                   // sick
consumption_ytd  = SUM(abs(days)) WHERE entry_type='consumption'
                   AND effective_date >= Jan 1 of current_year
target_balance   = MAX(0, allotment − consumption_ytd)
current_balance  = SUM(days)  // all entry types, signed
adjustment       = target_balance − current_balance

IF adjustment < 0:
    INSERT { entry_type='adjustment', days=adjustment,
             reason='Carryover forfeit per Kosovo statute',
             effective_date=Jul 1 }
```

Net effect: after July 1 the balance is capped at
`(current_year_allotment − consumption_ytd)`. Any days inherited from before
January 1 are forfeited.

### Idempotency

The forfeit job checks for an existing `adjustment` row with
`reason LIKE 'Carryover forfeit%'` and `effective_date = Jul 1` before writing.
Running it multiple times on the same date produces at most one row per
employee+leave_type.

### Backfill

The `backfill:leave-accrual` script (`npm run backfill:leave-accrual`) implements
the same two-year window:
- Hired **before last year** → last-year allotment + current-year allotment (4 rows).
- Hired **during last year** → pro-rated last-year + full current-year (4 rows).
- Hired **during current year** → pro-rated current-year only (2 rows).

The script **refuses to run** if any `consumption` rows exist, because wiping the
ledger would destroy records of leave already taken. Run manual review first.

---

## What Is NOT in This Phase

- API endpoints (routes, controllers, services)
- Frontend UI
- Accrual scheduling / cron jobs
- Working-days computation logic (`working_days_count` is computed by the caller)
- Notification events (RabbitMQ publish on approval/rejection)
- Balance reads via API
