import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@/shared/errors/app-error';

export function authorize(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) throw new ForbiddenError();

    if (user.roles.includes('super_admin')) { next(); return; }

    const hasAll = required.every(p => user.permissions.includes(p));
    if (!hasAll) throw new ForbiddenError(required.join(', '));

    next();
  };
}

export function authorizeAny(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) throw new ForbiddenError();
    if (user.roles.includes('super_admin')) { next(); return; }

    const hasAny = permissions.some(p => user.permissions.includes(p));
    if (!hasAny) throw new ForbiddenError(permissions.join(' OR '));

    next();
  };
}
