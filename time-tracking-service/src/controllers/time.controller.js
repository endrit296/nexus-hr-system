const TimeLog = require('../models/TimeLog');

exports.processSalary = async (req, res) => {
    try {
        const { employeeName, role, hourlyRate, hoursWorked } = req.body;

        if (!employeeName || typeof employeeName !== 'string' || !employeeName.trim()) {
            return res.status(400).json({ status: 'Error', message: 'employeeName is required' });
        }
        const rate  = parseFloat(hourlyRate);
        const hours = parseFloat(hoursWorked);
        if (!isFinite(rate)  || rate  <= 0) return res.status(400).json({ status: 'Error', message: 'hourlyRate must be a positive number' });
        if (!isFinite(hours) || hours <= 0) return res.status(400).json({ status: 'Error', message: 'hoursWorked must be a positive number' });

        const grossSalary = rate * hours;
        const taxAmount = grossSalary * 0.10;
        const netSalary = grossSalary - taxAmount;

        res.status(200).json({
            header: {
                company: "NEXUS HR SOLUTIONS",
                report_type: "Monthly Payroll Statement",
                date: new Date().toLocaleDateString()
            },
            employee_profile: {
                full_name: employeeName,
                position: role || "Staff Member"
            },
            financial_summary: {
                hours_logged: hours + " hrs",
                rate_per_hour: rate + " €",
                gross_total: grossSalary.toFixed(2) + " €",
                deductions: taxAmount.toFixed(2) + " € (Tax 10%)",
                final_net_salary: netSalary.toFixed(2) + " €"
            },
            status: "VERIFIED"
        });
    } catch (error) {
        res.status(500).json({ status: "Error", message: error.message });
    }
};