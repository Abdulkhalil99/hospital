import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error';
import { logger } from '@/infrastructure/logger/logger';

// 4 parameters = Express identifies this as error middleware
export function globalErrorHandler(
  err:   Error,
  req:   Request,
  res:   Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  // ── Known error (we threw it intentionally) ────────────────────────
  if (err instanceof AppError) {
    logger.warn('Application error', {
      code:       err.code,
      statusCode: err.statusCode,
      path:       req.path,
      method:     req.method,
      requestId,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    return;
  }

  // ── Unknown error (bug — log the full stack) ───────────────────────
  logger.error('Unexpected server error', {
    message:   err.message,
    stack:     err.stack,
    path:      req.path,
    requestId,
  });

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
    meta: { requestId, timestamp: new Date().toISOString() },
  });
}