const express    = require('express');
const morgan     = require('morgan');
const connectDB  = require('./db');
const authRoutes = require('./routes/auth');
const logger     = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

connectDB();

app.use('/auth', authRoutes);

app.get('/', (_req, res) => res.send('Auth Service Online'));

app.listen(PORT, () => logger.info(`Auth Service running on http://localhost:${PORT}`));
