import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:               z.enum(['development', 'production', 'test']).default('development'),
  PORT:                   z.string().default('3000').transform(Number),
  DATABASE_URL:           z.string().min(1),
  REDIS_URL:              z.string().default('redis://localhost:6379'),
  JWT_SECRET:             z.string().min(32),
  JWT_ACCESS_EXPIRES_IN:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS:           z.string().default('http://localhost:3001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Missing or invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);                // hard crash — refuse to start with bad config
}

const e = parsed.data;

export const config = {
  env:    e.NODE_ENV,
  port:   e.PORT,
  isDev:  e.NODE_ENV === 'development',
  isProd: e.NODE_ENV === 'production',

  db:    { url: e.DATABASE_URL },
  redis: { url: e.REDIS_URL },

  jwt: {
    secret:           e.JWT_SECRET,
    accessExpiresIn:  e.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: e.JWT_REFRESH_EXPIRES_IN,
  },

  cors: {
    origins: e.CORS_ORIGINS.split(',').map(o => o.trim()),
  },
} as const;