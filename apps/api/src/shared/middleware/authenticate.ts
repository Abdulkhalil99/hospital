import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/shared/utils/jwt.util';
import { UnauthorizedError } from '@/shared/errors/app-error';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id:          string;
        username:    string;
        roles:       string[];
        permissions: string[];
      };
    }
  }
}

export function authenticate(
  req:  Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  try {
    const token   = header.slice(7);
    const payload = verifyAccessToken(token);
    req.user = {
      id:          payload.sub,
      username:    payload.username,
      roles:       payload.roles,
      permissions: payload.permissions,
    };
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    throw new UnauthorizedError(isExpired ? 'Token expired' : 'Invalid token');
  }
}
