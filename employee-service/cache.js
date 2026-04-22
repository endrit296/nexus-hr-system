const Redis = require('ioredis');

let client = null;

const getClient = () => {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    client.on('error', () => {});
  }
  return client;
};

const get = async (key) => {
  try {
    const val = await getClient().get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttl = 30) => {
  try {
    await getClient().set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // Cache unavailable — degrade gracefully
  }
};

const del = async (...keys) => {
  try {
    await getClient().del(...keys);
  } catch {
    // ignore
  }
};

module.exports = { get, set, del };
