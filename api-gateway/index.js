const { getBreakerFor }         = require('./breaker');
const { register: regService,
        heartbeat: hbService,
        getAll: getAllServices }   = require('./registry');
const express                     = require('express');
const cors                        = require('cors');
const jwt                         = require('jsonwebtoken');
const rateLimit                   = require('express-rate-limit');
const morgan                      = require('morgan');
const swaggerUi                   = require('swagger-ui-express');
const { createProxyMiddleware }   = require('http-proxy-middleware');
const logger                      = require('./logger');
const { swaggerSpec }             = require('./swagger');

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
  { method: 'POST', path: '/api/auth/login'              },
  { method: 'POST', path: '/api/auth/register'           },
  { method: 'POST', path: '/api/auth/refresh'            },
  { method: 'POST', path: '/api/auth/logout'             },
  { method: 'POST', path: '/api/auth/forgot-password'    },
  { method: 'POST', path: '/api/v1/auth/login'           },
  { method: 'POST', path: '/api/v1/auth/register'        },
  { method: 'POST', path: '/api/v1/auth/refresh'         },
  { method: 'POST', path: '/api/v1/auth/logout'          },
  { method: 'POST', path: '/api/v1/auth/forgot-password' },
  { method: 'GET',  path: '/api/registry'           },
  { method: 'POST', path: '/api/registry/register'  },
  { method: 'POST', path: '/api/registry/heartbeat' },
  { method: 'GET',  path: '/health'                 },
];

const isPublic = (req) => {
  // All activate and reset-password paths are public (contain dynamic token segments)
  if (req.path.startsWith('/api/auth/activate/'))       return true;
  if (req.path.startsWith('/api/v1/auth/activate/'))    return true;
  if (req.path.startsWith('/api/auth/reset-password/')) return true;
  if (req.path.startsWith('/api/v1/auth/reset-password/')) return true;
  return PUBLIC_PATHS.some((p) => p.method === req.method && req.path === p.path);
};

// ── JWT verification middleware ───────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  if (isPublic(req)) return next();
  // Auth service manages its own token verification for /api/auth/* routes
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

// ── Proxy factory with Circuit Breaker (http-proxy-middleware v3) ─────────────
//
// How it works:
//   1. Before each request, check if the breaker for that service is OPEN.
//      If open → return 503 immediately (no request sent downstream).
//   2. If CLOSED/HALF-OPEN → forward the request via the proxy.
//   3. If the proxy gets a network error (service is unreachable), fire the
//      health-check probe so opossum can count failures and open the circuit
//      once the error threshold is crossed.
const makeProxy = (target, targetPrefix) => {
  const cb = getBreakerFor(target);

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => targetPrefix + (path === '/' ? '' : path),
    on: {
      // v3 event: fires when the downstream service cannot be reached
      error: (err, req, res) => {
        // Fire health probe to register a failure with opossum
        cb.fire().catch(() => {});
        logger.error(`[Proxy] ${target} unreachable: ${err.message}`);
        if (!res.headersSent) {
          res.status(503).json({ status: 'error', message: 'Service temporarily unavailable' });
        }
      },
    },
  });

  // Middleware wrapper — checks circuit state before forwarding
  return (req, res, next) => {
    if (cb.opened) {
      return res.status(503).json({
        status:  'error',
        message: 'Service temporarily unavailable (Circuit Breaker Active)',
      });
    }
    proxy(req, res, next);
  };
};

// ── v1 versioned proxy routes ─────────────────────────────────────────────────
app.use('/api/v1/auth',        makeProxy(AUTH_SERVICE,     '/auth'));
app.use('/api/v1/employees',   makeProxy(EMPLOYEE_SERVICE, '/employees'));
app.use('/api/v1/departments', makeProxy(EMPLOYEE_SERVICE, '/departments'));
app.use('/api/v1/payroll',     makeProxy(PAYROLL_SERVICE,  '/api/payroll'));

// ── Legacy /api/* routes (aliases) ───────────────────────────────────────────
app.use('/api/auth',        makeProxy(AUTH_SERVICE,     '/auth'));
app.use('/api/employees',   makeProxy(EMPLOYEE_SERVICE, '/employees'));
app.use('/api/departments', makeProxy(EMPLOYEE_SERVICE, '/departments'));
app.use('/api/payroll',     makeProxy(PAYROLL_SERVICE,  '/api/payroll'));

// ── Dynamic Service Registry ──────────────────────────────────────────────────
app.use(express.json());

app.post('/api/registry/register', (req, res) => {
  const { name, url } = req.body || {};
  if (!name || !url) return res.status(400).json({ message: 'name and url are required' });
  regService(name, url);
  res.json({ message: `${name} registered` });
});

app.post('/api/registry/heartbeat', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: 'name is required' });
  const found = hbService(name);
  if (!found) return res.status(404).json({ message: `${name} not registered` });
  res.json({ message: `heartbeat accepted for ${name}` });
});

app.get('/api/registry', (_req, res) => {
  res.json({ version: '1.0', discovery: 'dynamic', services: getAllServices() });
});

// ── Root & health ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Gateway Online'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'api-gateway', version: '1.0', timestamp: new Date().toISOString() })
);

app.listen(PORT, () => logger.info(`API Gateway running on http://localhost:${PORT}`));
