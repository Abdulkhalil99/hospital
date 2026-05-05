import 'tsconfig-paths/register';
import http from 'http';
import { config }          from '@/config';
import { logger }          from '@/infrastructure/logger/logger';
import { testDbConnection } from '@/infrastructure/database/db.client';
import { createApp }       from '@/app';

async function bootstrap() {
  logger.info('Starting MediCore API...', { env: config.env, port: config.port });

  // 1. Test DB connection
  await testDbConnection();

  // 2. Load i18n translations
  try {
    const { I18nService } = await import('./modules/i18n/i18n.service');
    await new I18nService().loadAllTranslations();
  } catch (err) {
    logger.warn('i18n load skipped', { error: String(err) });
  }

  // 3. Start EMR lock scheduler
  try {
    const { startEmrLockScheduler } = await import('./infrastructure/queue/workers/emr-lock.worker');
    startEmrLockScheduler();
  } catch (err) {
    logger.warn('EMR lock scheduler skipped', { error: String(err) });
  }

  // 4. Register billing hooks
  try {
    const { registerBillingHooks } = await import('./modules/billing/billing.hooks');
    registerBillingHooks();
  } catch (err) {
    logger.warn('Billing hooks skipped', { error: String(err) });
  }

  // 5. Register notification hooks + start worker
  try {
    const { registerNotificationHooks } = await import('./modules/notifications/notifications.hooks');
    registerNotificationHooks();
    const { startNotificationWorker } = await import('./modules/notifications/notifications.worker');
    startNotificationWorker();
    const { loadTemplateCache } = await import('./modules/notifications/template.engine');
    await loadTemplateCache();
  } catch (err) {
    logger.warn('Notification system skipped', { error: String(err) });
  }

  // 6. Create Express app
  const app        = createApp();
  const httpServer = http.createServer(app);

  // 7. Init WebSocket
  try {
    const { initWebSocket } = await import('./infrastructure/websocket/ws.server');
    initWebSocket(httpServer);
    logger.info('WebSocket server initialised');
  } catch (err) {
    logger.warn('WebSocket skipped', { error: String(err) });
  }

  // 8. Start listening
  httpServer.listen(config.port, () => {
    logger.info(`✅  MediCore API is running`, { port: config.port });
    logger.info(`   Health → http://localhost:${config.port}/health`);
    logger.info(`   Docs   → http://localhost:${config.port}/api/v1`);
  });

  // 9. Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(httpServer));
  process.on('SIGINT',  () => gracefulShutdown(httpServer));
}

function gracefulShutdown(server: http.Server) {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

bootstrap().catch(err => {
  console.error('💥  Fatal startup error:', err);
  process.exit(1);
});
