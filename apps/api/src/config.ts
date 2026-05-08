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

function optionalInt(key: string, fallback: number): number {
  return parseInt(process.env[key] ?? String(fallback), 10);
}

function optionalBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

// Validate on startup in production
function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required_prod = [
    'DATABASE_URL', 'JWT_SECRET', 'REDIS_URL',
    'CORS_ORIGINS', 'WEB_URL',
  ];

  const missing = required_prod.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }

  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}

validateProductionEnv();

export const config = {
  env:  optional('NODE_ENV', 'development'),
  port: optionalInt('PORT', 3000),

  db: {
    url:         optional('DATABASE_URL', 'postgresql://medicore_user:medicore_pass@localhost:5433/medicore_db'),
    poolMax:     optionalInt('DB_POOL_MAX', 20),
    poolIdle:    optionalInt('DB_POOL_IDLE_MS', 10000),
    poolAcquire: optionalInt('DB_POOL_ACQUIRE_MS', 30000),
    ssl:         optionalBool('DB_SSL', false),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    secret:           optional('JWT_SECRET', 'medicore_dev_secret_change_in_production_32chars_min'),
    accessExpiresIn:  optional('JWT_ACCESS_EXPIRES',  '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES', '7d'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:3001').split(',').map(s => s.trim()),
  },

  rateLimit: {
    windowMs:       optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    maxRequests:    optionalInt('RATE_LIMIT_MAX', 500),
    authMax:        optionalInt('RATE_LIMIT_AUTH_MAX', 20),
    uploadMax:      optionalInt('RATE_LIMIT_UPLOAD_MAX', 30),
  },

  smtp: {
    host: optional('SMTP_HOST', 'localhost'),
    port: optionalInt('SMTP_PORT', 1025),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', 'noreply@medicore.local'),
    secure: optionalBool('SMTP_SECURE', false),
  },

  twilio: {
    accountSid:  optional('TWILIO_ACCOUNT_SID', ''),
    authToken:   optional('TWILIO_AUTH_TOKEN', ''),
    phoneNumber: optional('TWILIO_PHONE_NUMBER', ''),
  },

  firebase: {
    projectId:   optional('FIREBASE_PROJECT_ID', ''),
    privateKey:  optional('FIREBASE_PRIVATE_KEY', ''),
    clientEmail: optional('FIREBASE_CLIENT_EMAIL', ''),
  },

  web: {
    url: optional('WEB_URL', 'http://localhost:3001'),
  },

  upload: {
    maxSizeMb:  optionalInt('UPLOAD_MAX_MB', 10),
    allowedTypes: optional('UPLOAD_ALLOWED_TYPES', 'image/jpeg,image/png,application/pdf'),
  },

  isDev:  optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',
  isTest: optional('NODE_ENV', 'development') === 'test',
};
