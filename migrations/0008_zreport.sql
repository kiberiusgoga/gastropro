BEGIN;

-- ── Z-Report support on shifts ────────────────────────────────────────────────

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS zreport_data         JSONB,
  ADD COLUMN IF NOT EXISTS zreport_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_difference      NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS closed_by_user_id    UUID REFERENCES users(id);

COMMENT ON COLUMN shifts.zreport_data IS
  'Frozen snapshot of all aggregate metrics at shift close. Single source
   of truth for Z-report rendering. Never recalculated after generation.';

COMMENT ON COLUMN shifts.cash_difference IS
  'actual_cash - expected_cash. Negative = shortage (manjak), positive = surplus (vishak).';

CREATE INDEX IF NOT EXISTS idx_shifts_active
  ON shifts(user_id, restaurant_id)
  WHERE status = 'open';

-- ── payment_method on orders ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN payment_method TEXT
      CHECK (payment_method IN ('cash', 'card', 'voucher', 'transfer', 'split'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_shift_status
  ON orders(shift_id, status)
  WHERE shift_id IS NOT NULL;

-- ── order_discounts — snapshot junction table ─────────────────────────────────
-- Schema only. Discount application UI is a separate feature.
-- orders.discount_amount remains the denormalized total for fast queries.
-- Z-report aggregates from this table; shows "no discounts" if empty.

CREATE TABLE IF NOT EXISTS order_discounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_id         UUID        REFERENCES discounts(id) ON DELETE SET NULL,

  -- Snapshot fields — immutable after row creation, like order_items.vat_rate.
  -- Historically accurate even if the source discount is later edited or deleted.
  applied_name        TEXT        NOT NULL,
  applied_type        TEXT        NOT NULL
                        CHECK (applied_type IN ('percentage', 'fixed', 'promotion', 'manual_override')),
  applied_value       NUMERIC(15, 4) NOT NULL,  -- decimal fraction (0.10) or fixed denar amount
  applied_amount      NUMERIC(15, 2) NOT NULL,  -- actual money discounted on this order
  reason              TEXT,                     -- required for manual_override, optional otherwise
  approved_by_user_id UUID        REFERENCES users(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_discounts IS
  'Discounts applied to orders. Snapshot of discount definition at
   application time. discount_id FK can become NULL if source discount
   is deleted — applied_* fields preserve historical accuracy.';

COMMENT ON COLUMN order_discounts.applied_type IS
  'percentage: applied_value is decimal fraction (0.10 = 10%).
   fixed: applied_value is denar amount.
   promotion: predefined campaign.
   manual_override: ad-hoc manager discount, requires non-empty reason.';

COMMENT ON COLUMN order_discounts.applied_amount IS
  'The actual money discounted on this specific order. Summing
   applied_amount for an order should equal orders.discount_amount.';

ALTER TABLE order_discounts
  ADD CONSTRAINT order_discounts_reason_required
  CHECK (applied_type != 'manual_override' OR (reason IS NOT NULL AND LENGTH(reason) > 0));

CREATE INDEX IF NOT EXISTS idx_order_discounts_order_id
  ON order_discounts(order_id);

CREATE INDEX IF NOT EXISTS idx_order_discounts_discount_id
  ON order_discounts(discount_id)
  WHERE discount_id IS NOT NULL;

-- ── auth_audit_log: add shift_closed ─────────────────────────────────────────

ALTER TABLE auth_audit_log DROP CONSTRAINT IF EXISTS auth_audit_log_action_check;
ALTER TABLE auth_audit_log ADD CONSTRAINT auth_audit_log_action_check
  CHECK (action IN (
    'login_success', 'login_failure', 'logout',
    'password_changed', 'password_reset_requested', 'password_reset_completed',
    'role_changed', 'account_created', 'account_deactivated',
    'refresh_rotated', 'refresh_revoked', 'suspected_token_theft',
    'refresh_chain_depth_exceeded',
    'sse_ticket_issued', 'sse_connection_opened', 'sse_forced_logout',
    'shift_closed'
  ));

COMMIT;
