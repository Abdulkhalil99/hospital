import { getDb } from '@/infrastructure/database/db.client';
import { logger } from '@/infrastructure/logger/logger';

// Run every hour — locks encounters completed more than 24 hours ago
export async function runEmrLockJob(): Promise<void> {
  const db = getDb();
  const { rowCount } = await db.query(
    `UPDATE emr.encounters
     SET locked_at = NOW()
     WHERE status    = 'completed'
       AND locked_at IS NULL
       AND completed_at < NOW() - INTERVAL '24 hours'`,
  );
  if ((rowCount ?? 0) > 0) {
    logger.info('EMR lock job: locked encounters', { count: rowCount });
  }
}

// Start the hourly scheduler
export function startEmrLockScheduler(): void {
  runEmrLockJob();                                   // run immediately on start
  setInterval(runEmrLockJob, 60 * 60 * 1000);        // then every hour
  logger.info('EMR lock scheduler started');
}
