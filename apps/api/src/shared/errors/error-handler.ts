import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error';
import { logger }   from '@/infrastructure/logger/logger';

export function globalErrorHandler(
  err:  Error,
  req:  Request,
  res:  Response,
  _next: NextFunction,
): void {
  // Known application error
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('App error', {
        code:    err.code,
        message: err.message,
        path:    req.path,
        method:  req.method,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' },
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
    });
    return;
  }

  // PostgreSQL errors
  if ((err as any).code === '23505') {
    res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with these details already exists' },
    });
    return;
  }

  if ((err as any).code === '23503') {
    res.status(400).json({
      success: false,
      error: { code: 'FOREIGN_KEY', message: 'Referenced record does not exist' },
    });
    return;
  }

  // Unknown error — never expose internals
  logger.error('Unhandled error', {
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
    meta: {
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString(),
    },
  });
}
