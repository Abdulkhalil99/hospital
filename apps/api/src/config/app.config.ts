import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:               z.enum(['development', 'production', 'test']).default('development'),
  PORT:                   z.string().default('3000').transform(Number),
  DATABASE_URL:           z.string(),
  REDIS_URL:              z.string().default('redis://localhost:6379'),
  JWT_SECRET:             z.string().min(32),
  JWT_ACCESS_EXPIRES_IN:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS:           z.string().default('http://localhost:3001'),
  S3_ENDPOINT:            z.string().optional(),
  S3_BUCKET:              z.string().optional(),
  S3_ACCESS_KEY:          z.string().optional(),
  S3_SECRET_KEY:          z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env:    parsed.data.NODE_ENV,
  port:   parsed.data.PORT,
  isDev:  parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  db:     { url: parsed.data.DATABASE_URL },
  redis:  { url: parsed.data.REDIS_URL },
  jwt: {
    secret:           parsed.data.JWT_SECRET,
    accessExpiresIn:  parsed.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },
  storage: {
    endpoint:  parsed.data.S3_ENDPOINT,
    bucket:    parsed.data.S3_BUCKET,
    accessKey: parsed.data.S3_ACCESS_KEY,
    secretKey: parsed.data.S3_SECRET_KEY,
  },
  cors: {
    origins: parsed.data.CORS_ORIGINS.split(',').map(o => o.trim()),
  },
} as const;
