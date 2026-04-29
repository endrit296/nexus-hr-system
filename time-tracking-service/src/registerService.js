'use strict';
const http   = require('http');
const logger = require('./logger');

const GATEWAY_HOST = process.env.GATEWAY_HOST || 'localhost';
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10);
const SERVICE_NAME = 'time-tracking-service';
const SERVICE_URL  = process.env.SERVICE_URL  || `http://localhost:${process.env.PORT || 3005}`;

const postJson = (path, body) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = http.request(
      {
        host:    GATEWAY_HOST,
        port:    GATEWAY_PORT,
        path,
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => { res.resume(); resolve(res.statusCode); }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });

const register = async () => {
  try {
    await postJson('/api/registry/register', { name: SERVICE_NAME, url: SERVICE_URL });
    logger.info(`[Registry] Registered with gateway as "${SERVICE_NAME}"`);
  } catch (err) {
    logger.warn(`[Registry] Registration failed — ${err.message}`);
  }
};

const startHeartbeat = () => {
  setInterval(async () => {
    try {
      await postJson('/api/registry/heartbeat', { name: SERVICE_NAME });
    } catch (err) {
      logger.warn(`[Registry] Heartbeat failed — ${err.message}`);
    }
  }, 15_000);
};

module.exports = { register, startHeartbeat };
