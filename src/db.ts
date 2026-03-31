import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from './lib/logger';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/placeholder',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

if (!process.env.DATABASE_URL) {
  logger.warn('DATABASE_URL is not set. Backend API will be unavailable.');
}

// Log database errors
pool.on('error', (err) => {
  if (process.env.DATABASE_URL) {
    logger.error('Unexpected error on idle client', { error: err.message, stack: err.stack });
  }
});

export const query = async (text: string, params?: unknown[]) => {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database not configured');
  }
  try {
    return await pool.query(text, params);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Database query error', { text, params, error: errorMessage });
    throw err;
  }
};

export const getClient = async () => {
  try {
    return await pool.connect();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Database connection error', { error: errorMessage });
    throw err;
  }
};

export default pool;
