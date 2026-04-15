const express = require('express');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = 3001;

app.use(express.json());

// Connect to MongoDB
connectDB();

app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Auth Service Online');
});

app.listen(PORT, () => {
  console.log(`Auth Service running on http://localhost:${PORT}`);
});
