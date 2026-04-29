import 'dotenv/config';           // load .env FIRST, before any import touches process.env
import http from 'http';
import { createApp }         from './app';
import { testDbConnection }  from './infrastructure/database/db.client';
import { logger }            from './infrastructure/logger/logger';

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap(): Promise<void> {
  logger.info('Starting MediCore API...', { env: process.env.NODE_ENV, port: PORT });

  // 1 — Verify database is reachable before accepting traffic
  await testDbConnection();

  const { I18nService } = await import('./modules/i18n/i18n.service');
  await new I18nService().loadAllTranslations();

  // 2 — Build the Express app
  const app        = createApp();
  const httpServer = http.createServer(app);

  // 3 — Start listening
  httpServer.listen(PORT, () => {
    logger.info('✅  MediCore API is running', { port: PORT });
    logger.info(`   Health → http://localhost:${PORT}/health`);
    logger.info(`   Patients → http://localhost:${PORT}/api/v1/patients`);
  });

  // 4 — Graceful shutdown: finish in-flight requests before dying
  const shutdown = (signal: string): void => {
    logger.info(`${signal} — shutting down gracefully`);
    httpServer.close(() => {
      logger.info('HTTP server closed. Bye.');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('💥  Fatal startup error:', err);
  process.exit(1);
});