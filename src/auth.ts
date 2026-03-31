import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AuthenticationError, ForbiddenError } from './lib/errors';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_access_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'fallback_refresh_secret';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const generateAccessToken = (user: { id: string; email: string; role: string }) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (user: { id: string; email: string; role: string }) => {
  return jwt.sign(user, REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
};

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) throw new AuthenticationError('Unauthorized');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new ForbiddenError('Invalid or expired token'));
    req.user = user as { id: string; email: string; role: string };
    next();
  });
};

export const authorizeRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
};
