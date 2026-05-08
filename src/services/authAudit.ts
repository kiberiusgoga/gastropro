import pool from '../db';

interface AuthEvent {
  user_id?: string | null;
  restaurant_id?: string | null;
  action: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

const FORBIDDEN_KEYS = [
  'password', 'password_hash', 'token', 'refresh_token',
  'access_token', 'jwt', 'authorization', 'temp_password',
];

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | null {
  if (!metadata) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

export async function logAuthEvent(event: AuthEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO auth_audit_log
         (user_id, restaurant_id, action, ip_address, user_agent,
          metadata, success)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.user_id || null,
        event.restaurant_id || null,
        event.action,
        event.ip_address || null,
        event.user_agent?.slice(0, 500) || null,
        sanitizeMetadata(event.metadata),
        event.success !== false,
      ]
    );
  } catch (err) {
    // Audit log failure must NEVER break the main flow.
    console.error('[AUDIT] Failed to write audit log entry:', err);
  }
}
