import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically random temporary password.
 * - 16 characters
 * - Mix of upper, lower, digits, and safe symbols
 * - Excludes ambiguous chars (0/O, 1/l/I) for verbal communication
 * - Uses crypto.randomBytes (not Math.random) for unpredictability
 */
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const length = 16;
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}
