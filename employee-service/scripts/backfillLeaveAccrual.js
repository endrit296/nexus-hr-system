'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { connectDB, sequelize } = require('../config/database');
const leaveService             = require('../application/services/LeaveService');
const leaveRepo                = require('../infrastructure/repositories/LeaveRepository');
const logger                   = require('../logger');

async function runBackfill(actorUserId = 'backfill-script') {
  // Safety guard: refuse to run if consumption entries exist — a wipe would destroy
  // records of leave already taken.
  const hasConsumption = await leaveRepo.hasConsumptionEntries();
  if (hasConsumption) {
    throw new Error(
      'Aborting: consumption entries exist. Manual review required before re-running backfill.'
    );
  }

  const employees = await leaveRepo.findAllEmployees();

  const summary = {
    processed:              employees.length,
    succeeded:              0,
    failed:                 0,
    ledger_entries_written: 0,
    failures:               [],
  };

  // Single transaction: wipe the entire ledger then re-seed per employee so the
  // DB is never left in a half-migrated state.
  await sequelize.transaction(async (t) => {
    await leaveRepo.destroyAllLedgerEntries({ transaction: t });

    for (const emp of employees) {
      if (!emp.hireDate) {
        logger.warn(`[Backfill] Employee ${emp.id} skipped: no hire_date`);
        summary.failed++;
        summary.failures.push({ employee_id: emp.id, error: 'Employee has no hire_date — cannot backfill' });
        continue;
      }

      try {
        const written = await leaveService.replayLeaveAccrualForEmployee(emp, actorUserId, t);
        summary.succeeded++;
        summary.ledger_entries_written += written;
        logger.info(`[Backfill] Employee ${emp.id} (${emp.email}): ${written} entries written`);
      } catch (e) {
        logger.warn(`[Backfill] Employee ${emp.id} failed: ${e.message}`);
        summary.failed++;
        summary.failures.push({ employee_id: emp.id, error: e.message });
      }
    }
  });

  return summary;
}

module.exports = { runBackfill };

if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const summary = await runBackfill();
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    } catch (e) {
      console.error('Backfill failed fatally:', e.message);
      process.exit(1);
    }
  })();
}
