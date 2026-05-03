import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { config }     from '@/config';
import { logger }     from '@/infrastructure/logger/logger';
import { globalErrorHandler }  from '@/shared/errors/error-handler';
import { authRouter }          from '@/modules/auth/auth.router';
import { patientsRouter }      from '@/modules/patients/patients.router';
import { doctorsRouter }       from '@/modules/doctors/doctors.router';
import { appointmentsRouter }  from '@/modules/appointments/appointments.router';
import { notificationsRouter }  from '@/modules/notifications/notifications.router';
import { billingRouter }        from '@/modules/billing/billing.router';
import { emergencyRouter }      from '@/modules/emergency/emergency.router';
import { laboratoryRouter }     from '@/modules/laboratory/laboratory.router';
import { pharmacyRouter }       from '@/modules/pharmacy/pharmacy.router';
import { emrRouter }           from '@/modules/emr/emr.router';
import { i18nRouter }          from '@/modules/i18n/i18n.router';
import { i18nMiddleware }      from '@/shared/middleware/i18n.middleware';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.cors.origins, credentials: true }));

  app.use((req, _res, next) => {
    req.headers['x-request-id'] ??= uuid();
    next();
  });

  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method:    req.method,
      path:      req.path,
      requestId: req.headers['x-request-id'],
    });
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(i18nMiddleware);

  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      500,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    },
  }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/auth',         authRouter);
  app.use('/api/v1/patients',     patientsRouter);
  app.use('/api/v1/doctors',      doctorsRouter);
  app.use('/api/v1/appointments', appointmentsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/billing',       billingRouter);
  app.use('/api/v1/emergency',     emergencyRouter);
  app.use('/api/v1/laboratory',    laboratoryRouter);
  app.use('/api/v1/pharmacy',      pharmacyRouter);
  app.use('/api/v1/emr',          emrRouter);
  app.use('/api/v1/i18n',         i18nRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route does not exist' },
    });
  });

  app.use(globalErrorHandler);
  return app;
}
