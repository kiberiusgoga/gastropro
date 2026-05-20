BEGIN;

-- =========================================================
-- Phase A foundation cleanup: unify transaction logs.
--
-- Two parallel inventory transaction systems exist:
--   - transactions (manual movements, 38 rows, since 0001)
--   - inventory_transactions (POS deductions, 0 rows, never wired)
--
-- This migration consolidates onto transactions and drops the unused
-- inventory_transactions. Schema is widened, types are remapped, and
-- new audit columns added. Indexes added for future query patterns.
--
-- After this migration:
--   - One canonical inventory movement log: transactions
--   - updateStock() is the single write path (refactored in code)
--   - deductForOrderItem routes through updateStock with allowNegative
--   - Tenancy bug in deduction service fixed via guarded write path
-- =========================================================

-- Step 1: Rename column for naming consistency with rest of schema
ALTER TABLE transactions
  RENAME COLUMN date TO created_at;

-- Step 2: Add new audit columns (nullable, populated as data flows in)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

COMMENT ON COLUMN transactions.reference_type IS
  'Source category of the movement: order_item, invoice, po_receive,
   manual, inventory_check. NULL for legacy entries.';

COMMENT ON COLUMN transactions.reason IS
  'Human-readable detail about the movement (e.g., low_stock_override,
   order_cancelled_restore). Free-form text, not enforced.';

-- Step 3: DROP the old CHECK constraint FIRST — before any type
-- remapping. The old constraint only allows input/output/receipt/
-- inventory_check/storno. Updating to output_manual while the old
-- constraint is live would violate it and roll back.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%receipt%';

  IF v_conname IS NULL THEN
    RAISE EXCEPTION
      'Migration 0016: transactions type CHECK not found via receipt anchor. '
      'Inspect pg_constraint and update this migration before retrying.';
  END IF;

  EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', v_conname);
END $$;

-- Step 4: Remap legacy type values to new canonical enum.
-- Constraint is now dropped — UPDATEs are unconstrained until Step 5.
--
-- input (8 rows): all "Прием..." notes — semantically same as receipt
-- output (14 rows): mixed sales + consumption — cannot reliably split,
-- all become output_manual (lossy but acceptable for historical rows)
UPDATE transactions SET type = 'receipt'       WHERE type = 'input';
UPDATE transactions SET type = 'output_manual' WHERE type = 'output';

-- Step 5: Backfill reference_type for existing rows where reference_id
-- is already set. Currently 0 rows match (all 38 have reference_id IS
-- NULL) but the UPDATE is correct for future replay scenarios.
UPDATE transactions
SET reference_type = 'invoice'
WHERE reference_type IS NULL
  AND reference_id IS NOT NULL
  AND type = 'receipt';

-- Step 6: Add the new canonical CHECK constraint now that all rows
-- have been remapped to valid values.
ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'receipt',          -- incoming from invoice or PO
    'output_sale',      -- POS recipe deduction (new)
    'output_manual',    -- manual warehouse movement
    'restore_cancel',   -- restored after order cancel (new)
    'inventory_check',  -- physical count adjustment
    'storno'            -- manual reversal
  ));

-- Step 7: Performance indexes for future query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_reference
  ON transactions(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_restaurant_created
  ON transactions(restaurant_id, created_at DESC);

-- Step 8: Drop inventory_transactions (0 rows, 0 readers, confirmed
-- in discovery). Safe and irreversible. Schema unification complete.
DROP TABLE IF EXISTS inventory_transactions;

COMMIT;
