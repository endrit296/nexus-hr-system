const express    = require('express');
const helmet     = require('helmet');
const morgan     = require('morgan');
const connectDB  = require('./db');
const authRoutes = require('./routes/auth');
const logger     = require('./logger');
const { getMongoDbUri, getRequiredEnv, getServiceUrl } = require('./config');
const { register, startHeartbeat } = require('./registerService');

const app  = express();
const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('env', NODE_ENV);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Fail fast on missing production-critical configuration before the server boots.
getMongoDbUri();
getRequiredEnv('JWT_SECRET');

app.use('/auth', authRoutes);

app.get('/',       (_req, res) => res.send('Auth Service Online'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
app.get('/ping',   (_req, res) => res.status(200).send('pong'));

const startServer = async () => {
  await connectDB();

  app.listen(PORT, async () => {
    logger.info(`Auth Service running in ${NODE_ENV} mode on ${getServiceUrl()}`);
    await register();
    startHeartbeat();
  });
};

startServer().catch((error) => {
  logger.error(`Auth Service startup failed: ${error.message}`);
  process.exit(1);
});
