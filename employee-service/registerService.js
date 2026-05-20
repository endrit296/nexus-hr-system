'use strict';
const http   = require('http');
const https  = require('https');
const { URL } = require('url');
const logger = require('./logger');
const { getGatewayUrl, getServiceUrl } = require('./runtimeConfig');

const SERVICE_NAME = 'employee-service';

const postJson = (baseUrl, path, body) =>
  new Promise((resolve, reject) => {
    const data       = JSON.stringify(body);
    const requestUrl = new URL(path, baseUrl);
    const client     = requestUrl.protocol === 'https:' ? https : http;
    const req        = client.request(
      {
        protocol: requestUrl.protocol,
        hostname: requestUrl.hostname,
        port:     requestUrl.port || undefined,
        path:     `${requestUrl.pathname}${requestUrl.search}`,
        method:   'POST',
        headers:  {
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
  const gatewayUrl = getGatewayUrl();

  if (!gatewayUrl) {
    logger.info('[Registry] Skipping registration because no gateway URL is configured');
    return;
  }

  try {
    await postJson(gatewayUrl, '/api/registry/register', { name: SERVICE_NAME, url: getServiceUrl() });
    logger.info(`[Registry] Registered with gateway as "${SERVICE_NAME}"`);
  } catch (err) {
    logger.warn(`[Registry] Registration failed - ${err.message}`);
  }
};

const startHeartbeat = () => {
  const gatewayUrl = getGatewayUrl();

  if (!gatewayUrl) {
    return;
  }

  setInterval(async () => {
    try {
      await postJson(gatewayUrl, '/api/registry/heartbeat', { name: SERVICE_NAME });
    } catch (err) {
      logger.warn(`[Registry] Heartbeat failed - ${err.message}`);
    }
  }, 15_000);
};

module.exports = { register, startHeartbeat };
