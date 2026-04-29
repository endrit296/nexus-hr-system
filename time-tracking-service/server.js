const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
require('dotenv').config();

const timeRoutes = require('./src/routes/time.routes');
const logger     = require('./src/logger');
const { register, startHeartbeat } = require('./src/registerService');

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Reject requests that didn't come through the API gateway (gateway always forwards x-user-role)
app.use('/api/payroll', (req, res, next) => {
  if (!req.headers['x-user-role']) {
    return res.status(401).json({ message: 'Unauthorized: direct access not permitted' });
  }
  next();
});

app.use('/api/payroll', timeRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'time-tracking-service' }));

app.listen(PORT, async () => {
  logger.info(`Time-Tracking Service running on http://localhost:${PORT}`);
  await register();
  startHeartbeat();
});
