BEGIN;

-- =========================================================
-- Phase C: warehouse routing by table + internal transfers
-- =========================================================

-- ---------------------------------------------------------
-- 1. Add warehouse_id to restaurant_tables
-- ---------------------------------------------------------
ALTER TABLE restaurant_tables
  ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

-- ---------------------------------------------------------
-- 2. Data migration: assign every table (active + inactive) to main warehouse
-- ---------------------------------------------------------
UPDATE restaurant_tables t
SET warehouse_id = w.id
FROM warehouses w
WHERE w.restaurant_id = t.restaurant_id
  AND w.is_main = TRUE
  AND t.warehouse_id IS NULL;

-- ---------------------------------------------------------
-- 3. Enforce NOT NULL after backfill
-- ---------------------------------------------------------
ALTER TABLE restaurant_tables
  ALTER COLUMN warehouse_id SET NOT NULL;

-- Index for warehouse-by-table lookups
CREATE INDEX idx_restaurant_tables_warehouse
  ON restaurant_tables(warehouse_id);

-- ---------------------------------------------------------
-- 4. internal_transfers table
-- ---------------------------------------------------------
CREATE TABLE internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  destination_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(15,3) NOT NULL,
  user_id UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_transfers_different_warehouses
    CHECK (source_warehouse_id != destination_warehouse_id),
  CONSTRAINT internal_transfers_positive_quantity
    CHECK (quantity > 0)
);

-- Indexes for common queries
CREATE INDEX idx_internal_transfers_restaurant
  ON internal_transfers(restaurant_id);
CREATE INDEX idx_internal_transfers_source
  ON internal_transfers(source_warehouse_id);
CREATE INDEX idx_internal_transfers_destination
  ON internal_transfers(destination_warehouse_id);
CREATE INDEX idx_internal_transfers_product
  ON internal_transfers(product_id);
CREATE INDEX idx_internal_transfers_created
  ON internal_transfers(restaurant_id, created_at DESC);

COMMIT;
