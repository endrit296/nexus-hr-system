const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Allow requests from the React frontend (dev) and Nginx load balancer (Docker)
const allowedOrigins = ['http://localhost:5173', 'http://localhost'];
app.use(cors({ origin: allowedOrigins }));

// Service hostnames: use env vars (Docker) with localhost fallbacks (dev)
const AUTH_SERVICE     = process.env.AUTH_SERVICE_URL     || 'http://localhost:3001';
const EMPLOYEE_SERVICE = process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3002';

// Proxy /api/auth/* → auth-service
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => '/auth' + (path === '/' ? '' : path),
  })
);

// Proxy /api/employees/* → employee-service
app.use(
  '/api/employees',
  createProxyMiddleware({
    target: EMPLOYEE_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => '/employees' + (path === '/' ? '' : path),
  })
);

// Proxy /api/departments/* → employee-service
app.use(
  '/api/departments',
  createProxyMiddleware({
    target: EMPLOYEE_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => '/departments' + (path === '/' ? '' : path),
  })
);

// Root route — proves the gateway is online
app.get('/', (req, res) => {
  res.send('Gateway Online');
});

// Health check route — returns machine-readable status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});
