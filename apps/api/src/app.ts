import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { config }     from '@/config';
import { logger }     from '@/infrastructure/logger/logger';
import { globalErrorHandler } from '@/shared/errors/error-handler';

// ── Import module routers as you build each phase ─────────────────────
import { patientsRouter } from '@/modules/patients/patients.router';
import { authRouter } from '@/modules/auth/auth.router';
import { i18nRouter }   from '@/modules/i18n/i18n.router';
import { i18nMiddleware } from '@/shared/middleware/i18n.middleware';  from '@/modules/auth/auth.router';
// import { appointmentsRouter } from '@/modules/appointments/appointments.router';

export function createApp(): express.Application {
  const app = express();

  // ── Security headers ────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: config.cors.origins, credentials: true }));

  // ── Attach a unique requestId to every request ──────────────────────
  // This ID appears in every log line for that request
  app.use((req, _res, next) => {
    req.headers['x-request-id'] ??= uuid();
    next();
  });

  // ── Log every incoming request ──────────────────────────────────────
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method:    req.method,
      path:      req.path,
      ip:        req.ip,
      requestId: req.headers['x-request-id'],
    });
    next();
  });

  // ── Body parsing ─────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Rate limiting ────────────────────────────────────────────────────
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max:      500,               // 500 requests per window per IP
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    },
  }));

  // ── Health check — no auth, always responds ──────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Module routes ─────────────────────────────────────────────────────
  app.use('/api/v1/patients', patientsRouter);
  app.use('/api/v1/auth',         authRouter);
  // app.use('/api/v1/appointments', appointmentsRouter);

  // ── 404 for unknown routes ───────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route does not exist' },
    });
  });

  // ── Global error handler MUST be last ───────────────────────────────
  app.use(globalErrorHandler);

  return app;
}