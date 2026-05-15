BEGIN;

-- Extend the auth_audit_log action CHECK constraint to include 'invoice_created'.
--
-- PostgreSQL does not support ALTER CONSTRAINT — the only approach is DROP + recreate
-- with the full value list. Both operations are inside this transaction: if ADD fails,
-- the DROP is rolled back automatically and the old constraint is restored.
--
-- The 19 existing values are taken verbatim from the live constraint as of migration 0012.
-- Any future action must be added by the same DROP+recreate pattern in a new migration.

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  -- Locate the existing action CHECK by anchoring on 'login_success', present since 0005.
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid  = 'auth_audit_log'::regclass
    AND contype   = 'c'
    AND pg_get_constraintdef(oid) LIKE '%login_success%';

  -- Hard-abort if the anchor is missing. This means the constraint has already been
  -- dropped or renamed by a previous migration, and this migration must be reviewed
  -- before applying. A silent no-op here would leave the table without a constraint.
  IF v_conname IS NULL THEN
    RAISE EXCEPTION
      'Migration 0013: auth_audit_log action CHECK not found via login_success anchor. '
      'Inspect pg_constraint and update this migration before retrying.';
  END IF;

  EXECUTE format('ALTER TABLE auth_audit_log DROP CONSTRAINT %I', v_conname);
END $$;

-- ADD CONSTRAINT runs in the same transaction as the DO $$ DROP above.
-- If this statement fails for any reason, PostgreSQL rolls back the DROP
-- and the original constraint is fully restored — no window with no constraint.
ALTER TABLE auth_audit_log
  ADD CONSTRAINT auth_audit_log_action_check
  CHECK (action IN (
    -- Auth / session (0005, 0006, subsequent migrations)
    'login_success', 'login_failure', 'logout',
    'refresh_rotated', 'refresh_revoked', 'refresh_chain_depth_exceeded',
    'suspected_token_theft',
    -- Account lifecycle (0005)
    'account_created', 'account_deactivated',
    'password_changed', 'password_reset_requested', 'password_reset_completed',
    'role_changed',
    -- SSE (0006)
    'sse_ticket_issued', 'sse_connection_opened', 'sse_forced_logout',
    -- Operational
    'shift_closed',
    'menu_item_image_uploaded', 'menu_item_image_deleted',
    -- Inventory / purchasing (v0.16 — this migration)
    'invoice_created'
  ));

COMMIT;
