const breaker = require('./breaker');
const express       = require('express');
const cors          = require('cors');
const jwt           = require('jsonwebtoken');
const rateLimit     = require('express-rate-limit');
const morgan        = require('morgan');
const swaggerUi     = require('swagger-ui-express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const logger        = require('./logger');
const { swaggerSpec } = require('./swagger');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Env ───────────────────────────────────────────────────────────────────────
const JWT_SECRET       = process.env.JWT_SECRET           || 'nexus_jwt_secret_change_in_production';
const AUTH_SERVICE     = process.env.AUTH_SERVICE_URL     || 'http://localhost:3001';
const EMPLOYEE_SERVICE = process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3002';
const PAYROLL_SERVICE  = process.env.PAYROLL_SERVICE_URL  || 'http://localhost:3005';

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost'] }));

// ── API version header ────────────────────────────────────────────────────────
app.use((_req, res, next) => { res.setHeader('X-API-Version', '1.0'); next(); });

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

app.use(generalLimiter);

app.use(
  ['/api/auth/login', '/api/auth/register', '/api/v1/auth/login', '/api/v1/auth/register'],
  authLimiter
);

// ── Swagger docs (public — before verifyToken) ────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Public paths (skip JWT check) ────────────────────────────────────────────
const PUBLIC_PATHS = [
  { method: 'POST', path: '/api/auth/login'       },
  { method: 'POST', path: '/api/auth/register'    },
  { method: 'POST', path: '/api/auth/refresh'     },
  { method: 'POST', path: '/api/auth/logout'      },
  { method: 'POST', path: '/api/v1/auth/login'    },
  { method: 'POST', path: '/api/v1/auth/register' },
  { method: 'POST', path: '/api/v1/auth/refresh'  },
  { method: 'POST', path: '/api/v1/auth/logout'   },
  { method: 'GET',  path: '/api/registry'         },
  { method: 'GET',  path: '/health'               },
];

const isPublic = (req) =>
  PUBLIC_PATHS.some((p) => p.method === req.method && req.path === p.path);

// ── JWT verification middleware ──────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  if (isPublic(req)) return next();

  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/v1/auth/')) return next();

  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.headers['x-user-id']    = String(decoded.userId);
    req.headers['x-user-role']  = decoded.role;
    req.headers['x-username']   = decoded.username;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

app.use(verifyToken);

// ── Proxy factory (UPDATED WITH CIRCUIT BREAKER) ──────────────────────────────
const makeProxy = (target, targetPrefix) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => targetPrefix + (path === '/' ? '' : path),
    // Integrimi i Circuit Breaker
    onProxyReq: async (proxyReq, req, res) => {
      try {
        // Kontrollojmë shërbimin target përmes breaker
        await breaker.fire({ method: req.method, url: target });
      } catch (err) {
        // Nëse breaker është i hapur (shërbimi target është down)
        if (!res.headersSent) {
          res.status(503).json({ 
            status: 'error', 
            message: 'Service temporarily unavailable (Circuit Breaker Active)' 
          });
        }
        proxyReq.destroy(); // Ndalojmë kërkesën
      }
    }
  });

// ── v1 versioned proxy routes ─────────────────────────────────────────────────
app.use('/api/v1/auth',         makeProxy(AUTH_SERVICE,     '/auth'));
app.use('/api/v1/employees',    makeProxy(EMPLOYEE_SERVICE, '/employees'));
app.use('/api/v1/departments',  makeProxy(EMPLOYEE_SERVICE, '/departments'));
app.use('/api/v1/payroll',      makeProxy(PAYROLL_SERVICE,  '/api/payroll'));

// ── Legacy /api/* routes (aliases) ───────────────────────────────────────────
app.use('/api/auth',         makeProxy(AUTH_SERVICE,     '/auth'));
app.use('/api/employees',    makeProxy(EMPLOYEE_SERVICE, '/employees'));
app.use('/api/departments',  makeProxy(EMPLOYEE_SERVICE, '/departments'));
app.use('/api/payroll',      makeProxy(PAYROLL_SERVICE,  '/api/payroll'));

// ── Service registry ──────────────────────────────────────────────────────────
app.get('/api/registry', (_req, res) => {
  res.json({
    version:   '1.0',
    discovery: 'docker-dns',
    services: {
      'auth-service':     { url: AUTH_SERVICE,     endpoints: ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'] },
      'employee-service': { url: EMPLOYEE_SERVICE, endpoints: ['/employees', '/departments'] },
      'payroll-service':  { url: PAYROLL_SERVICE,  endpoints: ['/api/payroll/calculate'] },
    },
  });
});

// ── Root & health ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Gateway Online'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'api-gateway', version: '1.0', timestamp: new Date().toISOString() })
);

app.listen(PORT, () => logger.info(`API Gateway running on http://localhost:${PORT}`));