import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { config }     from '@/config';
import { logger }     from '@/infrastructure/logger/logger';
import { globalErrorHandler } from '@/shared/errors/error-handler';
import { i18nMiddleware }     from '@/shared/middleware/i18n.middleware';

// Routers — each wrapped in try/catch so one broken module
// does not prevent the others from loading
function safeRequire(path: string) {
  try { return require(path); } catch (e) { logger.warn(`Router not loaded: ${path}`, { error: String(e) }); return null; }
}

export function createApp(): express.Application {
  const app = express();

  // ── Security ────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin:      config.cors.origins,
    credentials: true,
    methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  }));

  // ── Request ID ──────────────────────────────────────────
  app.use((req, _res, next) => {
    req.headers['x-request-id'] ??= uuid();
    next();
  });

  // ── Body parsing ────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── i18n ────────────────────────────────────────────────
  app.use(i18nMiddleware);

  // ── Request logging ─────────────────────────────────────
  app.use((req, _res, next) => {
    if (!req.path.includes('/health')) {
      logger.info(`${req.method} ${req.path}`, { requestId: req.headers['x-request-id'] });
    }
    next();
  });

  // ── Rate limiting ────────────────────────────────────────
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      1000,
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again later.' },
    },
  }));

  // ── Health check ─────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.env });
  });

  // ── Mount routers ────────────────────────────────────────
  const routers: [string, string][] = [
    ['/api/v1/auth',          './modules/auth/auth.router'],
    ['/api/v1/patients',      './modules/patients/patients.router'],
    ['/api/v1/doctors',       './modules/doctors/doctors.router'],
    ['/api/v1/appointments',  './modules/appointments/appointments.router'],
    ['/api/v1/emr',           './modules/emr/emr.router'],
    ['/api/v1/pharmacy',      './modules/pharmacy/pharmacy.router'],
    ['/api/v1/laboratory',    './modules/laboratory/laboratory.router'],
    ['/api/v1/emergency',     './modules/emergency/emergency.router'],
    ['/api/v1/billing',       './modules/billing/billing.router'],
    ['/api/v1/notifications', './modules/notifications/notifications.router'],
    ['/api/v1/telemedicine',  './modules/telemedicine/telemedicine.router',
    ['/api/v1/reports', './modules/reports/reports.router']],
    ['/api/v1/i18n',          './modules/i18n/i18n.router'],
  ];

  for (const [path, modulePath] of routers) {
    const mod = safeRequire(modulePath);
    if (mod) {
      // Support both default export and named export
      const router = mod.default
        ?? mod[Object.keys(mod).find(k => k.endsWith('Router')) ?? ''];
      if (router) {
        app.use(path, router);
        logger.debug(`Mounted: ${path}`);
      }
    }
  }

  // ── 404 ──────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route does not exist' },
    });
  });

  // ── Global error handler ─────────────────────────────────
  app.use(globalErrorHandler);

  return app;
}
