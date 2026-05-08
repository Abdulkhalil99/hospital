import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken }               from '@/shared/utils/jwt.util';
import { UnauthorizedError }               from '@/shared/errors/app-error';

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

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token   = header.split(' ')[1];
  const payload = verifyAccessToken(token);

  req.user = {
    id:          payload.sub,
    username:    payload.username,
    roles:       payload.roles    ?? [],
    permissions: payload.permissions ?? [],
  };

  next();
}
