const express = require('express');
const router = express.Router();
const timeController = require('../controllers/time.controller');

router.post('/calculate', timeController.processSalary);

module.exports = router;