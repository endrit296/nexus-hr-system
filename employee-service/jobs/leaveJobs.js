const schedule    = require('node-schedule');
const leaveService = require('../application/services/LeaveService');
const logger       = require('../logger');

function startLeaveJobs() {
  // Job A — daily at 00:05: write consumption ledger entries for approved leaves
  // that have reached their start_date. Idempotent — safe to run multiple times.
  schedule.scheduleJob('5 0 * * *', async () => {
    logger.info('[LeaveJobs] Running daily consumption job');
    try {
      const count = await leaveService.processConsumptionEntries();
      logger.info(`[LeaveJobs] Daily consumption complete — ${count} entries written`);
    } catch (e) {
      logger.error(`[LeaveJobs] Daily consumption error: ${e.message}`);
    }
  });

  // Job B — yearly on Jan 1 at 00:01: grant annual + sick leave accruals
  schedule.scheduleJob('1 0 1 1 *', async () => {
    logger.info('[LeaveJobs] Running yearly accrual job');
    try {
      const count = await leaveService.processYearlyAccrual();
      logger.info(`[LeaveJobs] Yearly accrual complete — ${count} employees processed`);
    } catch (e) {
      logger.error(`[LeaveJobs] Yearly accrual error: ${e.message}`);
    }
  });

  // Job C — yearly on Jul 1 at 01:00: forfeit previous-year carryover per Kosovo statute
  schedule.scheduleJob('0 1 1 7 *', async () => {
    logger.info('[LeaveJobs] Running yearly forfeit job');
    try {
      const count = await leaveService.processYearlyForfeit();
      logger.info(`[LeaveJobs] Yearly forfeit complete — ${count} adjustments written`);
    } catch (e) {
      logger.error(`[LeaveJobs] Yearly forfeit error: ${e.message}`);
    }
  });

  logger.info('[LeaveJobs] Scheduled: daily consumption @ 00:05, yearly accrual @ Jan 1 00:01, yearly forfeit @ Jul 1 01:00');
}

module.exports = { startLeaveJobs };
