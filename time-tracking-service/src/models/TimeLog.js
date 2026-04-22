const mongoose = require('mongoose');

const TimeLogSchema = new mongoose.Schema({
    employeeName: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date },
    hoursWorked: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Completed'], default: 'Active' }
});

module.exports = mongoose.model('TimeLog', TimeLogSchema);