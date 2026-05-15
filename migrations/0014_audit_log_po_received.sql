BEGIN;

-- Add 'purchase_order_received' to the auth_audit_log action CHECK constraint.
-- Same DROP+recreate pattern as 0013. The anchor value 'login_success' has been
-- present since migration 0005 and is used to locate the constraint reliably.
-- Hard-aborts if the anchor is missing — never silently leaves the table unconstrained.
--
-- Values as of 0013: 20 (19 original + 'invoice_created').
-- This migration adds 1 → 21 total.

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid  = 'auth_audit_log'::regclass
    AND contype   = 'c'
    AND pg_get_constraintdef(oid) LIKE '%login_success%';

  IF v_conname IS NULL THEN
    RAISE EXCEPTION
      'Migration 0014: auth_audit_log action CHECK not found via login_success anchor. '
      'Inspect pg_constraint and update this migration before retrying.';
  END IF;

  EXECUTE format('ALTER TABLE auth_audit_log DROP CONSTRAINT %I', v_conname);
END $$;

ALTER TABLE auth_audit_log
  ADD CONSTRAINT auth_audit_log_action_check
  CHECK (action IN (
    -- Auth / session
    'login_success', 'login_failure', 'logout',
    'refresh_rotated', 'refresh_revoked', 'refresh_chain_depth_exceeded',
    'suspected_token_theft',
    -- Account lifecycle
    'account_created', 'account_deactivated',
    'password_changed', 'password_reset_requested', 'password_reset_completed',
    'role_changed',
    -- SSE
    'sse_ticket_issued', 'sse_connection_opened', 'sse_forced_logout',
    -- Operational
    'shift_closed',
    'menu_item_image_uploaded', 'menu_item_image_deleted',
    -- Inventory / purchasing (v0.16)
    'invoice_created',
    'purchase_order_received'
  ));

COMMIT;
