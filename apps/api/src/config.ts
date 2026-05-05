import dotenv from 'dotenv';
import path   from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env:  optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  db: {
    url: optional(
      'DATABASE_URL',
      'postgresql://medicore_user:medicore_pass@localhost:5433/medicore_db',
    ),
    poolMax:     parseInt(optional('DB_POOL_MAX', '20'), 10),
    poolIdle:    parseInt(optional('DB_POOL_IDLE', '10000'), 10),
    poolAcquire: parseInt(optional('DB_POOL_ACQUIRE', '30000'), 10),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    secret:          optional('JWT_SECRET', 'medicore_dev_secret_change_in_production_min_32_chars'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn:optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:3001').split(','),
  },

  smtp: {
    host: optional('SMTP_HOST', 'localhost'),
    port: parseInt(optional('SMTP_PORT', '1025'), 10),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', 'noreply@medicore.local'),
  },

  twilio: {
    accountSid: optional('TWILIO_ACCOUNT_SID', ''),
    authToken:  optional('TWILIO_AUTH_TOKEN', ''),
    phoneNumber:optional('TWILIO_PHONE_NUMBER', ''),
  },

  web: {
    url: optional('WEB_URL', 'http://localhost:3001'),
  },

  isDev:  optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',
};
