-- Migration: 0005_auth_security
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID        REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  ip_address   TEXT,
  user_agent   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_replaced_by ON refresh_tokens(replaced_by) WHERE replaced_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID        REFERENCES users(id)       ON DELETE NO ACTION,
  restaurant_id UUID        REFERENCES restaurants(id) ON DELETE NO ACTION,
  action        TEXT        NOT NULL CHECK (action IN (
                  'login_success', 'login_failure', 'logout',
                  'password_changed', 'password_reset_requested',
                  'password_reset_completed', 'role_changed',
                  'account_created', 'account_deactivated',
                  'refresh_rotated', 'refresh_revoked', 'suspected_token_theft'
                )),
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB,
  success       BOOLEAN     NOT NULL DEFAULT TRUE
);
-- TODO: When this table exceeds ~10M rows, partition by year (RANGE on timestamp).
CREATE INDEX IF NOT EXISTS idx_aal_user_id_timestamp ON auth_audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_aal_failures ON auth_audit_log(timestamp DESC) WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS idx_aal_action_timestamp ON auth_audit_log(action, timestamp DESC);

COMMIT;
