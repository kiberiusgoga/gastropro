BEGIN;

-- Short-lived single-use tickets for SSE authentication.
-- EventSource cannot send Authorization headers; a ticket is exchanged
-- server-side for a JWT and then immediately consumed on first use.
-- Plaintext ticket is never stored; only the SHA-256 hash is persisted.
CREATE TABLE IF NOT EXISTS sse_tickets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id)  ON DELETE CASCADE,
  ticket_hash   TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT
);

-- Partial index on un-used, unexpired tickets — the only rows ever scanned
-- by the atomic UPDATE ... WHERE used_at IS NULL AND expires_at > NOW().
CREATE INDEX IF NOT EXISTS idx_sse_tickets_expires_at
  ON sse_tickets(expires_at) WHERE used_at IS NULL;

-- TODO: nightly cleanup job: DELETE FROM sse_tickets WHERE created_at < NOW() - INTERVAL '24 hours';

-- Extend auth_audit_log action constraint to include SSE lifecycle events.
-- DROP + ADD is the only portable way to rename/extend a CHECK constraint.
ALTER TABLE auth_audit_log DROP CONSTRAINT IF EXISTS auth_audit_log_action_check;
ALTER TABLE auth_audit_log ADD CONSTRAINT auth_audit_log_action_check
  CHECK (action IN (
    'login_success', 'login_failure', 'logout',
    'password_changed', 'password_reset_requested', 'password_reset_completed',
    'role_changed', 'account_created', 'account_deactivated',
    'refresh_rotated', 'refresh_revoked', 'suspected_token_theft',
    'refresh_chain_depth_exceeded',
    'sse_ticket_issued', 'sse_connection_opened', 'sse_forced_logout'
  ));

COMMIT;
