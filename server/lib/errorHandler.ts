import type { Request, Response, NextFunction } from 'express';
import { AppError, normalizeError } from './errors';
import { logger } from './logger';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const appError = normalizeError(err);
  
  const logData: Record<string, unknown> = {
    method: req.method,
    path: req.path,
    statusCode: appError.statusCode,
    errorCode: appError.code,
    userId: req.session?.userId,
    ip: getClientIp(req),
  };
  
  if (!appError.isOperational) {
    logData.stack = err.stack;
    logger.error('ERROR', appError.message, logData);
  } else {
    logger.warn('ERROR', appError.message, logData);
  }
  
  const responseBody: Record<string, unknown> = {
    error: appError.message,
    code: appError.code,
    errorCode: appError.code,
  };
  
  if (appError.details) {
    responseBody.details = appError.details;
  }
  
  if (process.env.NODE_ENV === 'development' && !appError.isOperational) {
    responseBody.stack = err.stack;
  }
  
  res.status(appError.statusCode).json(responseBody);
}

export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = new AppError(
    `Route ${req.method} ${req.path} nicht gefunden`,
    404,
    'ROUTE_NOT_FOUND',
    true
  );
  next(error);
}
