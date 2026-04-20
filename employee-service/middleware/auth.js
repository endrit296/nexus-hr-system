// Reads the X-User-Role header injected by the API Gateway after JWT verification.
// The gateway is the single source of truth for authentication; this middleware
// only enforces authorization (what the already-authenticated user is allowed to do).

const requireRole = (...roles) => (req, res, next) => {
  const role = req.headers['x-user-role'];
  if (!role) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (!roles.includes(role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

module.exports = { requireRole };
