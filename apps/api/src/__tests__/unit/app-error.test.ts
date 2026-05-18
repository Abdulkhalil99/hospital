import {
  AppError, ValidationError, UnauthorizedError,
  ForbiddenError, NotFoundError, ConflictError,
} from '@/shared/errors/app-error';

describe('AppError classes', () => {

  it('ValidationError has correct status and code', () => {
    const err = new ValidationError([{ message: 'Field required' }]);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ message: 'Field required' }]);
  });

  it('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError has 403 status', () => {
    const err = new ForbiddenError('emr:write');
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain('emr:write');
  });

  it('NotFoundError formats message correctly', () => {
    const err = new NotFoundError('Patient', '123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Patient '123' not found");
  });

  it('ConflictError has 409 status', () => {
    const err = new ConflictError('Duplicate license number');
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('Duplicate license number');
  });

  it('instanceof AppError is true for all subclasses', () => {
    expect(new ValidationError([]) instanceof AppError).toBe(true);
    expect(new NotFoundError('X') instanceof AppError).toBe(true);
    expect(new ForbiddenError() instanceof AppError).toBe(true);
  });

});
