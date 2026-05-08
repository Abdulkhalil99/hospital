import express, { Request, Response, NextFunction } from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { config }     from '@/config';
import { logger }     from '@/infrastructure/logger/logger';
import { globalErrorHandler } from '@/shared/errors/error-handler';
import { i18nMiddleware }     from '@/shared/middleware/i18n.middleware';

function safeRequire(modulePath: string) {
  try {
    const mod = require(modulePath);
    return mod.default ?? mod[Object.keys(mod).find(k => k.endsWith('Router')) ?? ''] ?? null;
  } catch (e) {
    logger.warn(`Router not loaded: ${modulePath}`, { error: String(e) });
    return null;
  }
}

const ROUTERS: [string, string][] = [
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
  ['/api/v1/telemedicine',  './modules/telemedicine/telemedicine.router'],
  ['/api/v1/i18n',          './modules/i18n/i18n.router'],
  ['/api/v1/reports',       './modules/reports/reports.router'],
  ['/api/v1/admin',         './modules/admin/admin.router'],
  ['/api/v1/portal',        './modules/portal/portal.router'],
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
  for (const [path, modulePath] of ROUTERS) {
    const router = safeRequire(modulePath);
    if (router) {
      app.use(path, router);
      logger.debug(`Mounted: ${path}`);
    }
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
