import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../auth';

// Paths accessible even when must_change_password is TRUE.
// These are router-relative paths (the router is mounted at /api in server.ts).
const ALLOWED_PATHS = [
  /^\/auth\/change-password$/,
  /^\/auth\/logout$/,
  /^\/auth\/me$/,
];

export function checkPasswordChangeRequired(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = (req as AuthRequest).user;

  if (!user || !user.mustChangePassword) {
    return next();
  }

  const pathAllowed = ALLOWED_PATHS.some(pattern => pattern.test(req.path));
  if (pathAllowed) {
    return next();
  }

  res.status(403).json({
    error: 'Password change required',
    code: 'MUST_CHANGE_PASSWORD',
    message: 'You must change your password before using the system.',
  });
}
