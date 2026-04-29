import { Worker } from 'bullmq';
import { getRedis } from '../../cache/redis.client';
import { logger } from '../../logger/logger';
import { QUEUE_NAMES } from '../job-queue';

export function startNotificationWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      logger.info('Processing notification job', { jobId: job.id, type: job.name });
      // Notification sending logic will be implemented in Phase 11
    },
    { connection: getRedis() },
  );
}
