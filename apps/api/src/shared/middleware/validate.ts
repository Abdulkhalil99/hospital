import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError }             from 'zod';
import { ValidationError }                 from '@/shared/errors/app-error';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(
          err.errors.map(e => ({
            message: e.message,
            path:    e.path,
          })),
        );
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as Record<string, string>;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map(e => ({ message: e.message, path: e.path })));
      }
      next(err);
    }
  };
}
