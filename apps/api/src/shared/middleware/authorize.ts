import { Request, Response, NextFunction } from 'express';
import { ForbiddenError }                  from '@/shared/errors/app-error';

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ForbiddenError('Not authenticated');

    // Super admin bypasses all permission checks
    if (req.user.roles.includes('super_admin')) {
      next(); return;
    }

    // Check if user has ALL required permissions
    const missing = requiredPermissions.filter(
      p => !req.user!.permissions.includes(p),
    );

    if (missing.length > 0) {
      throw new ForbiddenError(`Missing permissions: ${missing.join(', ')}`);
    }

    next();
  };
}

export function authorizeRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ForbiddenError('Not authenticated');
    if (req.user.roles.includes('super_admin')) { next(); return; }

    const hasRole = roles.some(r => req.user!.roles.includes(r));
    if (!hasRole) throw new ForbiddenError(`Required role: ${roles.join(' or ')}`);
    next();
  };
}
