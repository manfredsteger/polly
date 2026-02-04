export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Nicht authentifiziert') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Keine Berechtigung') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Ressource') {
    super(`${resource} nicht gefunden`, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(message, 409, code, true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Zu viele Anfragen') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service nicht verfügbar') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(error.message, 500, 'INTERNAL_ERROR', false);
  }
  
  return new AppError('Ein unbekannter Fehler ist aufgetreten', 500, 'UNKNOWN_ERROR', false);
}
