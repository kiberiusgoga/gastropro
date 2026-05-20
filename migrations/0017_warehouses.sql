BEGIN;

-- =========================================================
-- Phase B: Multi-warehouse foundation
--
-- Adds:
--   1. warehouses table (per-restaurant, one is_main per restaurant)
--   2. stock_levels table (product × warehouse → quantity)
--   3. transactions.warehouse_id column
--   4. Trigger maintaining products.current_stock as cache
--   5. Data migration: main warehouse per restaurant
--   6. Data migration: products.current_stock → stock_levels
--   7. Backfill: existing transactions attributed to main warehouse
--
-- After this: stock_levels is the source of truth for per-warehouse
-- quantity. products.current_stock is a denormalized cache maintained
-- by the trigger. All existing read paths that check current_stock
-- continue to work without modification.
--
-- Schema decisions:
--   - Composite PK (warehouse_id, product_id) on stock_levels:
--     junction table pattern; uniqueness enforced at DB level with no
--     extra surrogate UUID.
--   - restaurant_id on stock_levels: enables single-table tenancy
--     guards on reads without always joining warehouses (same pattern
--     as transactions, invoice_items).
--   - No deleted_at on warehouses or stock_levels: soft-delete is not
--     universal here (only customers, suppliers use it). warehouses
--     aligns with products/restaurants/orders — hard-delete via
--     CASCADE. Add in a follow-up migration if needed.
--   - Partial UNIQUE index on is_main prevents multiple main warehouses
--     per restaurant at the index level (partial index is lighter than
--     a trigger or a constraint on a nullable column).
--
-- Adaptation note: restaurants.language column does not exist in this
-- schema (verified: SELECT column_name FROM information_schema.columns
-- WHERE table_name='restaurants' AND column_name='language' → 0 rows).
-- Backfill therefore uses 'Главен магацин' for all existing rows.
-- New restaurants receive a localized name at creation time via the
-- mainWarehouseName() helper in api.ts (mk/en/sq).
-- =========================================================

-- ---------------------------------------------------------
-- 1. warehouses table
-- ---------------------------------------------------------
CREATE TABLE warehouses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  is_main       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, name)
);

-- One main warehouse per restaurant — enforced at index level so the
-- constraint applies only to rows where is_main = TRUE (partial index).
CREATE UNIQUE INDEX idx_warehouses_one_main_per_restaurant
  ON warehouses(restaurant_id)
  WHERE is_main = TRUE;

CREATE INDEX idx_warehouses_restaurant ON warehouses(restaurant_id);

-- ---------------------------------------------------------
-- 2. stock_levels table — composite PK
-- ---------------------------------------------------------
CREATE TABLE stock_levels (
  warehouse_id  UUID           NOT NULL REFERENCES warehouses(id)  ON DELETE CASCADE,
  product_id    UUID           NOT NULL REFERENCES products(id)    ON DELETE CASCADE,
  restaurant_id UUID           NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  quantity      NUMERIC(15, 3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (warehouse_id, product_id)
);

CREATE INDEX idx_stock_levels_product    ON stock_levels(product_id);
CREATE INDEX idx_stock_levels_restaurant ON stock_levels(restaurant_id);

-- ---------------------------------------------------------
-- 3. transactions.warehouse_id column
-- ---------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

CREATE INDEX idx_transactions_warehouse
  ON transactions(warehouse_id)
  WHERE warehouse_id IS NOT NULL;

-- ---------------------------------------------------------
-- 4. Trigger: sync products.current_stock from stock_levels
--
-- Fires after any INSERT, quantity UPDATE, or DELETE on
-- stock_levels. Re-computes the SUM(quantity) across all
-- warehouses for the affected product and writes it back to
-- products.current_stock. This keeps the denormalized cache
-- accurate without callers needing to manage it.
--
-- Phase B operates one warehouse per restaurant, so the SUM
-- equals the single warehouse quantity. Phase C (multi-warehouse)
-- will keep the same semantics: current_stock = total across all.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_product_current_stock()
RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_product_id := OLD.product_id;
  ELSE
    target_product_id := NEW.product_id;
  END IF;

  UPDATE products
  SET current_stock = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM   stock_levels
    WHERE  product_id = target_product_id
  )
  WHERE id = target_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_levels_sync_current_stock
AFTER INSERT OR UPDATE OF quantity OR DELETE ON stock_levels
FOR EACH ROW EXECUTE FUNCTION sync_product_current_stock();

-- ---------------------------------------------------------
-- 5. Data migration: one main warehouse per existing restaurant
--
-- restaurants.language column is absent in this schema; all
-- existing restaurants receive the Macedonian default name.
-- The WHERE NOT EXISTS guard makes this idempotent.
-- ---------------------------------------------------------
INSERT INTO warehouses (restaurant_id, name, is_main)
SELECT id, 'Главен магацин', TRUE
FROM   restaurants
WHERE  NOT EXISTS (
  SELECT 1 FROM warehouses w
  WHERE  w.restaurant_id = restaurants.id
    AND  w.is_main = TRUE
);

-- ---------------------------------------------------------
-- 6. Data migration: copy products.current_stock → stock_levels
--
-- One row per product in that product's restaurant's main warehouse.
-- The trigger fires for each inserted row, re-computing
-- products.current_stock = SUM(stock_levels.quantity). Since only
-- one warehouse exists per product at this point, the SUM equals
-- the value just inserted — no-op in effect, but exercises the
-- trigger on real data.
-- ---------------------------------------------------------
INSERT INTO stock_levels (warehouse_id, product_id, restaurant_id, quantity)
SELECT w.id, p.id, p.restaurant_id, p.current_stock
FROM   products p
JOIN   warehouses w
       ON  w.restaurant_id = p.restaurant_id
       AND w.is_main = TRUE
WHERE  p.current_stock IS NOT NULL;

-- ---------------------------------------------------------
-- 7. Backfill: attribute all existing transactions to main warehouse
-- ---------------------------------------------------------
UPDATE transactions t
SET    warehouse_id = w.id
FROM   warehouses w
WHERE  t.restaurant_id = w.restaurant_id
  AND  w.is_main = TRUE
  AND  t.warehouse_id IS NULL;

COMMIT;
