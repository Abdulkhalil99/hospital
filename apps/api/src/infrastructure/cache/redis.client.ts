import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/infrastructure/logger/logger';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url);
    redis.on('connect', () => logger.info('✅  Redis connected'));
    redis.on('error',   (err) => logger.error('Redis error', { error: err.message }));
  }
  return redis;
}