import { Request, Response } from 'express';
import { authorize } from '@/shared/middleware/authorize';
import { ForbiddenError } from '@/shared/errors/app-error';

describe('Staff permission authorization', () => {
  const check = (roles: string[], permissions: string[], required = 'emr:read') => {
    const next = jest.fn();
    const req = { user: { id: 'user', roles, permissions } } as Request;
    authorize(required)(req, {} as Response, next);
    return next;
  };

  it.each(['emr:read', 'billing:read', 'appointment:read', 'appointment:create', 'appointment:cancel'])(
    'rejects patient accounts with stale staff permission %s', permission => {
      expect(() => check(['patient'], [permission], permission)).toThrow(ForbiddenError);
    },
  );

  it('permits staff with the required permission', () => {
    expect(check(['doctor'], ['emr:read'])).toHaveBeenCalledTimes(1);
  });

  it('retains authorized staff access for accounts that also have a patient role', () => {
    expect(check(['patient', 'doctor'], ['emr:read'])).toHaveBeenCalledTimes(1);
  });

  it('retains super admin access and denies staff without permission', () => {
    expect(check(['super_admin'], [])).toHaveBeenCalledTimes(1);
    expect(() => check(['doctor'], [])).toThrow(ForbiddenError);
  });
});
