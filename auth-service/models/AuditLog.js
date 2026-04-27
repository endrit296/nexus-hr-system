const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:  { type: String },
  action:    {
    type: String,
    required: true,
    enum: [
      'REGISTER', 'ACTIVATE',
      'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
      'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
      'ROLE_CHANGE', 'DELETE_USER',
      'PROFILE_UPDATE',
    ],
  },
  details:   { type: Object },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now },
});

AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
