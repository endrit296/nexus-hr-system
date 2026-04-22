const express = require('express');
const cors = require('cors');
require('dotenv').config();

const timeRoutes = require('./src/routes/time.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes - Adresa kryesore e sahatit dhe rrogave
app.use('/api/payroll', timeRoutes);

const PORT = 3005;

app.listen(PORT, () => {
    console.log("\n" + "=".repeat(45));
    console.log("💎 NEXUS HR SYSTEM - PAYROLL MODULE");
    console.log("=".repeat(45));
    console.log(`🚀 STATUS:  Running Successfully`);
    console.log(`📡 PORT:    ${PORT}`);
    console.log(`🔗 URL:     http://localhost:${PORT}/api/payroll`);
    console.log("=".repeat(45) + "\n");
});