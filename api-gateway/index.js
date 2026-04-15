const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Allow requests from the React frontend
app.use(cors({ origin: 'http://localhost:5173' }));

// Proxy /api/auth/* → auth-service on port 3001
// Note: Express strips the matched prefix before passing to middleware,
// so req.url is the remainder (e.g. /register). We restore the /auth prefix.
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: (path) => '/auth' + (path === '/' ? '' : path),
  })
);

// Proxy /api/employees/* → employee-service on port 3002
app.use(
  '/api/employees',
  createProxyMiddleware({
    target: 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: (path) => '/employees' + (path === '/' ? '' : path),
  })
);

// Proxy /api/departments/* → employee-service on port 3002
app.use(
  '/api/departments',
  createProxyMiddleware({
    target: 'http://localhost:3002',
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
