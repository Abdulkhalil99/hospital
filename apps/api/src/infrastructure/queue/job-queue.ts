import { Queue } from 'bullmq';
import { getRedis } from '../cache/redis.client';

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: getRedis() }));
  }
  return queues.get(name)!;
}

export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  REPORTS:       'reports',
} as const;
