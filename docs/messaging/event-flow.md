# Nexus HR — Asynchronous Messaging Architecture

> **Status:** Conceptual design. Not yet implemented in code.
> This document describes the event-driven extension that would replace direct
> REST calls between employee-service and time-tracking-service with RabbitMQ.

---

## Why RabbitMQ (not Kafka)?

| Concern | Choice |
|---------|--------|
| Message volume | Low-moderate (HR events, not click-streams) — AMQP is sufficient |
| Ordering | Per-employee ordering needed — RabbitMQ consistent-hash exchange handles it |
| Durability | Durable queues + persistent messages cover the requirement |
| Operational complexity | RabbitMQ is simpler to operate than Kafka for this scale |

---

## Exchange & Queue Layout

```
Exchange: nexus.hr   (type: topic, durable: true)

Routing key pattern      → Queue                    → Consumer
─────────────────────────────────────────────────────────────────
employee.created         → q.payroll.onboard        → time-tracking-service
employee.deleted         → q.payroll.offboard       → time-tracking-service
employee.status_changed  → q.payroll.status         → time-tracking-service
employee.*               → q.audit.all              → (future audit-service)
```

---

## Events

### `employee.created`
Published by **employee-service** after `POST /employees` succeeds.

```json
{
  "event":       "employee.created",
  "version":     "1.0",
  "timestamp":   "2025-04-22T10:00:00.000Z",
  "payload": {
    "employeeId":   42,
    "firstName":    "Jane",
    "lastName":     "Doe",
    "email":        "jane.doe@nexushr.com",
    "position":     "Software Developer",
    "departmentId": 3,
    "hireDate":     "2025-04-22"
  }
}
```

**Consumer action (time-tracking-service):** Create an initial `TimeLog` document
with `status: "active"` and `checkIn: hireDate` to begin payroll tracking.

---

### `employee.deleted`
Published by **employee-service** after `DELETE /employees/:id` succeeds.

```json
{
  "event":     "employee.deleted",
  "version":   "1.0",
  "timestamp": "2025-04-22T10:00:00.000Z",
  "payload": {
    "employeeId": 42,
    "email":      "jane.doe@nexushr.com"
  }
}
```

**Consumer action (time-tracking-service):** Mark open TimeLogs for this employee
as `status: "terminated"` and close the `checkOut` timestamp.

---

### `employee.status_changed`
Published by **employee-service** after `PUT /employees/:id` when `status` changes.

```json
{
  "event":     "employee.status_changed",
  "version":   "1.0",
  "timestamp": "2025-04-22T10:00:00.000Z",
  "payload": {
    "employeeId": 42,
    "oldStatus":  "active",
    "newStatus":  "on_leave"
  }
}
```

**Consumer action (time-tracking-service):** Pause payroll accumulation while
`on_leave`; resume on next `active` transition.

---

## Message Reliability

| Property | Setting |
|----------|---------|
| Exchange durability | `durable: true` |
| Queue durability | `durable: true` |
| Message persistence | `deliveryMode: 2` (persistent) |
| Consumer acknowledgement | Manual `ack` after successful DB write |
| Dead-letter exchange | `nexus.hr.dlx` — routes failed messages for inspection |
| Retry strategy | 3 attempts with 5s exponential backoff via DLX |

---

## Implementation Sketch (Node.js / amqplib)

```js
// employee-service/messaging/publisher.js
const amqp = require('amqplib');

async function publishEvent(routingKey, payload) {
  const conn    = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertExchange('nexus.hr', 'topic', { durable: true });
  channel.publish(
    'nexus.hr',
    routingKey,
    Buffer.from(JSON.stringify({ event: routingKey, version: '1.0', timestamp: new Date(), payload })),
    { persistent: true }
  );
  await channel.close();
  await conn.close();
}

module.exports = { publishEvent };
```

```js
// time-tracking-service/messaging/consumer.js
const amqp = require('amqplib');

async function startConsumer() {
  const conn    = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertExchange('nexus.hr', 'topic', { durable: true });
  const { queue } = await channel.assertQueue('q.payroll.onboard', { durable: true });
  await channel.bindQueue(queue, 'nexus.hr', 'employee.created');
  channel.consume(queue, async (msg) => {
    const event = JSON.parse(msg.content.toString());
    await handleEmployeeCreated(event.payload);
    channel.ack(msg);
  });
}
```

---

## Docker Compose Addition (when implementing)

```yaml
rabbitmq:
  image: rabbitmq:3-management-alpine
  ports:
    - '5672:5672'   # AMQP
    - '15672:15672' # Management UI
  environment:
    - RABBITMQ_DEFAULT_USER=nexus
    - RABBITMQ_DEFAULT_PASS=nexuspass
  restart: unless-stopped
```
