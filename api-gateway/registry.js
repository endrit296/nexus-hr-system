'use strict';
const logger = require('./logger');

const HEARTBEAT_TIMEOUT_MS = 30_000;

const _reg = new Map();

const register = (name, url) => {
  _reg.set(name, { url, status: 'UP', lastHeartbeat: Date.now() });
  logger.info(`[Registry] + ${name} @ ${url}`);
};

const heartbeat = (name) => {
  const entry = _reg.get(name);
  if (!entry) return false;
  entry.lastHeartbeat = Date.now();
  if (entry.status !== 'UP') {
    entry.status = 'UP';
    logger.info(`[Registry] ${name} recovered → UP`);
  }
  return true;
};

const getAll = () => {
  const now      = Date.now();
  const snapshot = {};
  for (const [name, entry] of _reg.entries()) {
    if (entry.status === 'UP' && now - entry.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      entry.status = 'DOWN';
      logger.warn(`[Registry] ${name} → DOWN (no heartbeat for ${HEARTBEAT_TIMEOUT_MS / 1000}s)`);
    }
    snapshot[name] = {
      url:           entry.url,
      status:        entry.status,
      lastHeartbeat: new Date(entry.lastHeartbeat).toISOString(),
    };
  }
  return snapshot;
};

module.exports = { register, heartbeat, getAll };
