// Base — all custom errors extend this
export class AppError extends Error {
  constructor(
    public readonly code:       string,     // e.g. 'PATIENT_NOT_FOUND'
    public readonly message:    string,     // shown to the client
    public readonly statusCode: number = 500,
    public readonly details?:   unknown[],  // validation field errors etc.
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// 404
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      `${resource.toUpperCase().replace(/ /g, '_')}_NOT_FOUND`,
      identifier
        ? `${resource} '${identifier}' not found`
        : `${resource} not found`,
      404,
    );
  }
}

// 401 — not logged in at all
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

// 403 — logged in but lacking permission
export class ForbiddenError extends AppError {
  constructor(permission?: string) {
    super(
      'FORBIDDEN',
      permission ? `Missing permission: ${permission}` : 'Access denied',
      403,
    );
  }
}

// 422 — body failed Zod validation
export class ValidationError extends AppError {
  constructor(details: unknown[]) {
    super('VALIDATION_ERROR', 'Request validation failed', 422, details);
  }
}

// 409 — e.g. duplicate national ID
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}