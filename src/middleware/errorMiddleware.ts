import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../lib/errors';
import { ZodError } from 'zod';
import logger from '../lib/logger';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Log the error using Winston
  logger.error(`${req.method} ${req.url}`, {
    message: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  if (err instanceof AppError) {
    const errorResponse: Record<string, unknown> = {
      status: 'error',
      message: err.message,
    };

    if (err instanceof ValidationError && err.errors) {
      errorResponse.errors = err.errors;
    }

    return res.status(err.statusCode).json(errorResponse);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Handle unexpected errors
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(500).json({
    status: 'error',
    message: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

// Async wrapper to catch errors and pass to next()
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
