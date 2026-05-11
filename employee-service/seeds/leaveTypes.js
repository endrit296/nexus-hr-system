const LeaveType = require('../models/LeaveType');
const logger    = require('../logger');

const LEAVE_TYPES = [
  {
    code:                   'annual',
    name:                   'Annual Leave',
    isPaid:                 true,
    requiresProofAfterDays: null,
    maxRetroactiveDays:     null,
  },
  {
    code:                   'sick',
    name:                   'Sick Leave',
    isPaid:                 true,
    requiresProofAfterDays: 3,
    maxRetroactiveDays:     7,
  },
];

async function seedLeaveTypes() {
  for (const t of LEAVE_TYPES) {
    const [, created] = await LeaveType.findOrCreate({
      where:    { code: t.code },
      defaults: t,
    });
    if (created) logger.info(`Seeded leave type: ${t.code}`);
  }
}

module.exports = { seedLeaveTypes };
