import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AuthenticationError, ForbiddenError } from './lib/errors';

dotenv.config();

function requireSecret(name: string): string {
  const val = process.env[name];
  if (!val || val.length < 32) {
    console.error(
      `FATAL: Environment variable ${name} must be set and at least 32 characters long. ` +
      `Refusing to start. Set it in your .env file or deployment environment.`
    );
    process.exit(1);
  }
  return val;
}

const JWT_SECRET = requireSecret('JWT_SECRET');
const REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    restaurantId: string;
    name?: string;
    mustChangePassword?: boolean;
  };
}

export const generateAccessToken = (user: { id: string; email: string; role: string; restaurantId: string; mustChangePassword?: boolean }) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const generateRefreshToken = (user: { id: string; email: string; role: string; restaurantId: string }) => {
  return jwt.sign(user, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { id: string; email: string; role: string; restaurantId: string };
  } catch {
    return null;
  }
};

export const verifyAccessToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; restaurantId: string };
  } catch {
    return null;
  }
};

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) throw new AuthenticationError('Unauthorized');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new AuthenticationError('Invalid or expired token'));
    req.user = user as { id: string; email: string; role: string; restaurantId: string; mustChangePassword?: boolean };
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
