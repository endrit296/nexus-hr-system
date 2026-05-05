const requireRole = (...roles) => (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ message: 'Authentication required' });
    if (!roles.includes(role)) return res.status(403).json({ message: 'Insufficient permissions' });
    next();
};

module.exports = { requireRole };
