const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = 8080;

const JWT_SECRET       = process.env.JWT_SECRET || 'nexus_jwt_secret_change_in_production';
const AUTH_SERVICE     = process.env.AUTH_SERVICE_URL     || 'http://localhost:3001';
const EMPLOYEE_SERVICE = process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3002';

// Allow requests from the React frontend (dev) and Nginx load balancer (Docker)
const allowedOrigins = ['http://localhost:5173', 'http://localhost'];
app.use(cors({ origin: allowedOrigins }));

// ── Public auth routes that don't require a token ────────────────────────────

const PUBLIC_PATHS = [
  { method: 'POST', path: '/api/auth/login'    },
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/refresh'  },
  { method: 'POST', path: '/api/auth/logout'   },
];

const isPublic = (req) =>
  PUBLIC_PATHS.some(
    (p) => p.method === req.method && req.path === p.path
  );

// ── JWT verification middleware ──────────────────────────────────────────────
// Decodes the token and injects X-User-* headers so every downstream service
// can trust the caller's identity and role without re-verifying the JWT.

const verifyToken = (req, res, next) => {
  if (isPublic(req)) return next();

  // Also allow admin-only auth endpoints to self-protect in auth-service
  if (req.path.startsWith('/api/auth/')) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.headers['x-user-id']   = String(decoded.userId);
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-username']  = decoded.username;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

app.use(verifyToken);

// ── Proxy /api/auth/* → auth-service ─────────────────────────────────────────

app.use(
  '/api/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => '/auth' + (path === '/' ? '' : path),
  })
);

// ── Proxy /api/employees/* → employee-service ────────────────────────────────

app.use(
  '/api/employees',
  createProxyMiddleware({
    target: EMPLOYEE_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => '/employees' + (path === '/' ? '' : path),
  })
);

// ── Proxy /api/departments/* → employee-service ──────────────────────────────

app.use(
  '/api/departments',
  createProxyMiddleware({
    target: EMPLOYEE_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => '/departments' + (path === '/' ? '' : path),
  })
);

// ── Root & health ─────────────────────────────────────────────────────────────

app.get('/', (_req, res) => res.send('Gateway Online'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() })
);

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});
