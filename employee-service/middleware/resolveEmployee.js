const employeeRepository = require('../infrastructure/repositories/EmployeeRepository');

// Attempts to resolve the Postgres employee record from the x-user-email header.
// Sets req.employee to the Employee instance, or null if no linked record exists.
// Never fails — routes decide whether a null employee is acceptable.
const resolveEmployee = async (req, res, next) => {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ message: 'Authentication required' });
  try {
    req.employee = await employeeRepository.findByEmail(email) || null;
  } catch {
    req.employee = null;
  }
  next();
};

module.exports = { resolveEmployee };
