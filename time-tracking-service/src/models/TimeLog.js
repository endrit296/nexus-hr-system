const mongoose = require('mongoose');

const TimeLogSchema = new mongoose.Schema({
    employeeId:           { type: Number, required: true, index: true },
    employeeNameSnapshot: { type: String },
    checkIn:              { type: Date, required: true },
    checkOut:             { type: Date },
    hoursWorked:          { type: Number, default: 0 },
    status:               { type: String, enum: ['Active', 'Completed'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('TimeLog', TimeLogSchema);
