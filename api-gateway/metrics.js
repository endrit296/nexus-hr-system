'use strict';
const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register, prefix: 'nexus_' });

const httpRequestsTotal = new client.Counter({
  name:       'nexus_http_requests_total',
  help:       'Total HTTP requests handled by the API gateway',
  labelNames: ['method', 'route', 'status_code'],
  registers:  [register],
});

const httpRequestDuration = new client.Histogram({
  name:       'nexus_http_request_duration_seconds',
  help:       'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers:  [register],
});

const circuitBreakerState = new client.Gauge({
  name:       'nexus_circuit_breaker_open',
  help:       '1 when the circuit breaker for a service is open, 0 when closed',
  labelNames: ['service'],
  registers:  [register],
});

// Normalise dynamic path segments so cardinality stays bounded
const normalisePath = (path) =>
  path
    .replace(/\/[0-9a-f]{24}/gi, '/:id')   // Mongo ObjectIds
    .replace(/\/\d+/g, '/:id')             // numeric IDs
    .replace(/\?.*$/, '');                  // drop query strings

const requestMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  const route = normalisePath(req.path);

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
};

module.exports = { register, requestMiddleware, circuitBreakerState };
