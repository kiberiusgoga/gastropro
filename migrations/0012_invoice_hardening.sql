BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0012: Invoice hardening
--
-- Scope:
--   • invoice_items : name snapshot, tenant column, per-batch expiry
--   • products      : default shelf-life hint for invoice form auto-suggest
--   • invoices      : initial-inventory flag, purchase-order source link
--   • Indexes       : three targeted indexes (two partial)
--
-- No existing columns are modified. No data is removed.
-- invoice_items currently has 0 rows — NOT NULL columns are safe without
-- real backfill, but all patterns are written defensively for replay safety.
-- Every ADD COLUMN and CREATE INDEX uses IF NOT EXISTS for idempotency.
-- FK constraints use DO $$ blocks because PostgreSQL does not support
-- ADD CONSTRAINT IF NOT EXISTS natively.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── invoice_items: name ───────────────────────────────────────────────────────
--
-- No DEFAULT is intentional. We want a hard NOT NULL violation at the DB level
-- if a caller omits the product name — a silent empty string in a historical
-- invoice would be worse than a failed INSERT. Step 2 (POST /invoices hardening)
-- will ensure all INSERTs supply this column.

-- Phase A: add nullable so the statement is idempotent even if rows existed.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS name TEXT;

-- Phase B: no backfill — invoice_items has 0 rows at migration time. If this
-- were ever replayed against a populated table, the correct backfill would be:
--   UPDATE invoice_items ii
--   SET name = p.name
--   FROM products p
--   WHERE ii.product_id = p.id AND ii.name IS NULL;
-- Left as a comment only; do not run against 0-row tables (no-op, but documents intent).

-- Phase C: enforce NOT NULL — safe because all rows (zero of them) have a value.
ALTER TABLE invoice_items ALTER COLUMN name SET NOT NULL;

COMMENT ON COLUMN invoice_items.name IS
  'Snapshot of the product name at the moment this line item was received. '
  'Immutable after insert: historical invoices remain accurate even if the '
  'product is later renamed or soft-deleted. Populated by the caller; '
  'no DB default — a missing name is a bug, not a recoverable state.';


-- ── invoice_items: restaurant_id (4-phase NOT NULL pattern) ──────────────────
--
-- Denormalizing tenant onto invoice_items lets us query expiry dashboards and
-- cost reports with a single table scan instead of always joining invoices.
--
-- Even though invoice_items has 0 rows today, we always use the 4-phase pattern
-- for any NOT NULL FK addition. If this migration is replayed against a staging
-- restore that has rows, Phase B handles it correctly.

-- Phase A: add as nullable — the column must exist before any UPDATE can touch it.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- Phase B: backfill from the parent invoice. We derive tenant from the invoice
-- (not the product) because a product could theoretically be shared, but an
-- invoice belongs to exactly one restaurant by definition.
UPDATE invoice_items ii
SET    restaurant_id = i.restaurant_id
FROM   invoices i
WHERE  ii.invoice_id = i.id
  AND  ii.restaurant_id IS NULL;

-- Phase C: every row now has a value — safe to enforce NOT NULL.
ALTER TABLE invoice_items ALTER COLUMN restaurant_id SET NOT NULL;

-- Phase D: add FK last, after the column is fully populated and constrained.
-- ON DELETE CASCADE mirrors the invoice→line-item ownership relationship:
-- deleting an invoice removes its line items. The restaurant cascade is a
-- safety net, not the primary deletion path.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname    = 'invoice_items_restaurant_id_fkey'
      AND  conrelid   = 'invoice_items'::regclass
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN invoice_items.restaurant_id IS
  'Denormalized tenant column, copied from invoices.restaurant_id at insert time. '
  'Allows tenant-scoped queries on invoice_items (expiry dashboard, cost reports) '
  'without joining to the parent invoice every time. Must always equal the parent '
  'invoice restaurant_id — enforced by the INSERT path, not by a DB trigger.';


-- ── invoice_items: expiry_date ────────────────────────────────────────────────
--
-- Nullable because not every product is perishable. NULL = non-perishable or
-- no batch tracking required for this line item. DATE (not TIMESTAMPTZ) because
-- expiry is a calendar day, not a moment in time — timezone arithmetic is wrong here.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS expiry_date DATE;

COMMENT ON COLUMN invoice_items.expiry_date IS
  'Best-before / use-by date for this specific received batch. NULL for '
  'non-perishable products (dry goods, equipment, etc.). When the parent '
  'product has default_expiry_days set, the invoice form auto-suggests '
  'invoice.date + default_expiry_days as a starting value for staff to confirm.';


-- ── products: default_expiry_days ─────────────────────────────────────────────
--
-- Nullable: the majority of restaurant inventory has no formal expiry tracking.
-- When set, this is a UI hint for the invoice receipt form — it does NOT enforce
-- a hard expiry limit anywhere in the system. Stored per-product (not per-category)
-- so it can be tuned individually without affecting similar products.
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_expiry_days INTEGER;

COMMENT ON COLUMN products.default_expiry_days IS
  'Default shelf life in days after receipt. The invoice form uses this to '
  'auto-suggest expiry_date = invoice.date + default_expiry_days for this product. '
  'NULL means no auto-suggestion; staff must enter or omit expiry manually. '
  'This is a UI hint only — it does not create hard enforcement anywhere.';


-- ── invoices: is_initial_inventory ───────────────────────────────────────────
--
-- Distinguishes opening-stock-load invoices from real supplier deliveries.
-- During onboarding, operators need to enter current stock levels without a
-- real supplier invoice. This flag marks those rows so they can be excluded
-- from purchase-cost reporting and supplier-spend analysis without resorting
-- to a magic supplier name or a separate table.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_initial_inventory BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN invoices.is_initial_inventory IS
  'TRUE for onboarding / opening-stock invoices that establish initial inventory '
  'levels rather than recording a real supplier delivery. Excluded from '
  'purchase-cost and supplier-spend reports. Defaults to FALSE for every new '
  'row — regular invoices never need to set this explicitly.';


-- ── invoices: source_purchase_order_id ───────────────────────────────────────
--
-- Links an invoice to the purchase order that was converted into it, when the
-- PO → Invoice workflow is used. Nullable because invoices can also be created
-- directly for ad-hoc deliveries that had no prior PO.
--
-- ON DELETE SET NULL: if a purchase order is deleted, the linked invoice must
-- survive intact — we never lose receipt history. The invoice simply loses its
-- PO reference (source_purchase_order_id becomes NULL).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_purchase_order_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname  = 'invoices_source_po_fkey'
      AND  conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_source_po_fkey
      FOREIGN KEY (source_purchase_order_id)
      REFERENCES purchase_orders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN invoices.source_purchase_order_id IS
  'FK to the purchase_order that was converted into this invoice, if any. '
  'NULL for invoices created directly without a prior PO (ad-hoc deliveries). '
  'ON DELETE SET NULL: deleting a PO does not delete its invoice — the receipt '
  'record is preserved with this field nulled out.';


-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Tenant column index: every tenant-scoped query on invoice_items filters by
-- restaurant_id. Without this, those queries scan the full table.
CREATE INDEX IF NOT EXISTS idx_invoice_items_restaurant_id
  ON invoice_items(restaurant_id);

-- Partial index on expiry_date: only indexes rows where expiry_date IS NOT NULL.
-- Most rows will be non-perishables (NULL). Including them in a full index wastes
-- space and adds write overhead for no benefit — expiry queries always filter
-- WHERE expiry_date IS NOT NULL, which matches this partial predicate exactly.
CREATE INDEX IF NOT EXISTS idx_invoice_items_expiry_date
  ON invoice_items(expiry_date)
  WHERE expiry_date IS NOT NULL;

-- Partial index on source_purchase_order_id: only indexes rows linked to a PO.
-- Most invoices will be ad-hoc (source_purchase_order_id IS NULL). A full index
-- would store mostly NULLs. The only lookup pattern is "find invoice by PO id",
-- which this partial index covers completely.
CREATE INDEX IF NOT EXISTS idx_invoices_source_po
  ON invoices(source_purchase_order_id)
  WHERE source_purchase_order_id IS NOT NULL;

COMMIT;
