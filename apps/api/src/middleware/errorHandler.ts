import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, API_ERROR_MESSAGES } from '@NexusKey/shared';

/**
 * Centralized error translation: every route handler throws either an
 * ApiError (known, expected failure) or lets an unexpected error bubble up.
 * Both are converted here into a consistent JSON shape and logged with
 * full detail server-side, while the client only ever receives the safe,
 * user-facing message — internal error details (stack traces, SQL errors)
 * never leak into an HTTP response.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    req.log?.warn({ code: err.code, details: err.details }, 'handled ApiError');
    res.status(err.httpStatus).json({
      error: { code: err.code, message: API_ERROR_MESSAGES[err.code] },
    });
    return;
  }

  // A route calling schema.parse() directly (rather than safeParse + a
  // manual ApiError throw) still gets a proper 400 here instead of a
  // generic 500 -- every zod validation failure across every route is
  // covered by this one branch, not just the routes that remembered to
  // catch it locally.
  if (err instanceof ZodError) {
    req.log?.warn({ issues: err.issues }, 'validation error');
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: API_ERROR_MESSAGES.VALIDATION_ERROR },
    });
    return;
  }

  req.log?.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: API_ERROR_MESSAGES.INTERNAL_ERROR },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: API_ERROR_MESSAGES.NOT_FOUND },
  });
}
