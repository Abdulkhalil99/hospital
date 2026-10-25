import express, { Request, Response, NextFunction } from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { config }     from '@/config';
import { logger }     from '@/infrastructure/logger/logger';
import { globalErrorHandler } from '@/shared/errors/error-handler';
import { i18nMiddleware }     from '@/shared/middleware/i18n.middleware';
import { authRouter } from './modules/auth/auth.router';
import { patientsRouter } from './modules/patients/patients.router';
import { doctorsRouter } from './modules/doctors/doctors.router';
import { appointmentsRouter } from './modules/appointments/appointments.router';
import { emrRouter } from './modules/emr/emr.router';
import { pharmacyRouter } from './modules/pharmacy/pharmacy.router';
import { laboratoryRouter } from './modules/laboratory/laboratory.router';
import { emergencyRouter } from './modules/emergency/emergency.router';
import { billingRouter } from './modules/billing/billing.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { telemedicineRouter } from './modules/telemedicine/telemedicine.router';
import { i18nRouter } from './modules/i18n/i18n.router';
import { reportsRouter } from './modules/reports/reports.router';
import { adminRouter } from './modules/admin/admin.router';
import { portalRouter } from './modules/portal/portal.router';
import { inpatientRouter } from './modules/inpatient/inpatient.router';
import { operationsRouter } from './modules/operations/operations.router';
import { radiologyRouter } from './modules/radiology/radiology.router';
import { careMessagesRouter } from './modules/portal/engagement.router';

const ROUTERS: [string, express.Router][] = [
  ['/api/v1/care-messages', careMessagesRouter],
  ['/api/v1/inpatient', inpatientRouter],
  ['/api/v1/operations', operationsRouter],
  ['/api/v1/radiology', radiologyRouter],
  ['/api/v1/auth',          authRouter],
  ['/api/v1/patients',      patientsRouter],
  ['/api/v1/doctors',       doctorsRouter],
  ['/api/v1/appointments',  appointmentsRouter],
  ['/api/v1/emr',           emrRouter],
  ['/api/v1/pharmacy',      pharmacyRouter],
  ['/api/v1/laboratory',    laboratoryRouter],
  ['/api/v1/emergency',     emergencyRouter],
  ['/api/v1/billing',       billingRouter],
  ['/api/v1/notifications', notificationsRouter],
  ['/api/v1/telemedicine',  telemedicineRouter],
  ['/api/v1/i18n',          i18nRouter],
  ['/api/v1/reports',       reportsRouter],
  ['/api/v1/admin',         adminRouter],
  ['/api/v1/portal',        portalRouter],
];

export function createApp(): express.Application {
  const app = express();

  // ── Trust proxy (nginx / load balancer) ─────────────────────
  app.set('trust proxy', 1);

  // ── Security headers ─────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ── CORS ─────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || config.cors.origins.includes(origin) || config.isDev) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Request-ID','Accept-Language'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  }));

  // ── Request ID ───────────────────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = (req.headers['x-request-id'] as string) ?? uuid();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-ID', id);
    next();
  });

  // ── Body parsing ─────────────────────────────────────────────
  app.use(express.json({
    limit: `${config.upload.maxSizeMb}mb`,
    strict: true,
  }));
  app.use(express.urlencoded({ extended: true, limit: `${config.upload.maxSizeMb}mb` }));

  // ── i18n ─────────────────────────────────────────────────────
  app.use(i18nMiddleware);

  // ── Request logging ──────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.path.includes('/health') && !req.path.includes('/favicon')) {
      logger.info(`→ ${req.method} ${req.path}`, {
        requestId: req.headers['x-request-id'],
        ip:        req.ip,
        ua:        req.headers['user-agent']?.slice(0, 60),
      });
    }
    next();
  });

  // ── Global rate limit ────────────────────────────────────────
  app.use('/api/', rateLimit({
    windowMs:        config.rateLimit.windowMs,
    max:             config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator:    (req) => req.ip ?? 'unknown',
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
    },
    skip: (req) => config.isDev && req.ip === '::1',
  }));

  // ── Strict auth rate limit ────────────────────────────────────
  app.use('/api/v1/auth/login', rateLimit({
    windowMs:    15 * 60 * 1000,
    max:         config.rateLimit.authMax,
    message: {
      success: false,
      error: { code: 'TOO_MANY_LOGIN_ATTEMPTS', message: 'Too many login attempts. Try again in 15 minutes.' },
    },
  }));

  // ── Health check ─────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      env:       config.env,
      version:   process.env.npm_package_version ?? '1.0.0',
    });
  });

  // ── Mount all routers ─────────────────────────────────────────
  for (const [path, router] of ROUTERS) {
    app.use(path, router);
    logger.debug(`Mounted: ${path}`);
  }

  // ── 404 ──────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error:   { code: 'ROUTE_NOT_FOUND', message: 'Route does not exist' },
    });
  });

  // ── Global error handler ──────────────────────────────────────
  app.use(globalErrorHandler);

  return app;
}
