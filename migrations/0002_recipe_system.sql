-- Migration: 0002_recipe_system
-- Description: Recipe/normative system + POS inventory deduction tracking
-- Safe to re-run: all DDL uses IF NOT EXISTS
--
-- Unit conversion rules enforced in the application layer
-- (services/inventoryDeductionService.ts):
--
--   recipe_unit | inventory unit | factor
--   ------------|----------------|--------
--   'g'         | 'kg'           | / 1000
--   'ml'        | 'l'            | / 1000
--   'kg'        | 'kg'           | x 1
--   'l'         | 'l'            | x 1
--   'pcs'       | 'pcs'          | x 1
--   'pcs'       | 'box'          | x 1  (allowed, with warning)
--   'box'       | 'box'          | x 1
--
-- To add new units: add a new CHECK value below (new migration),
-- then add the conversion pair in inventoryDeductionService.ts.

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID          NOT NULL REFERENCES restaurants(id)  ON DELETE CASCADE,
  menu_item_id      UUID          NOT NULL REFERENCES menu_items(id)   ON DELETE CASCADE,
  inventory_item_id UUID          NOT NULL REFERENCES products(id)     ON DELETE RESTRICT,
  quantity          DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  recipe_unit       VARCHAR(10)   NOT NULL
                    CHECK (recipe_unit IN ('g', 'ml', 'kg', 'l', 'pcs', 'box')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (menu_item_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_menu_item_id
  ON recipe_ingredients(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_item_id
  ON recipe_ingredients(inventory_item_id);

DROP TRIGGER IF EXISTS update_recipe_ingredients_updated_at ON recipe_ingredients;
CREATE TRIGGER update_recipe_ingredients_updated_at
  BEFORE UPDATE ON recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Separate from the legacy `transactions` table (warehouse movements).
-- This table covers POS-driven inventory deductions only.
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID          NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id UUID          NOT NULL REFERENCES products(id)   ON DELETE RESTRICT,
  -- Negative = deduction (sale), positive = restore (cancellation)
  change_amount     DECIMAL(10,3) NOT NULL,
  reason            VARCHAR(50)   NOT NULL
                    CHECK (reason IN (
                      'order_completed',
                      'low_stock_override',
                      'order_cancelled_restore',
                      'manual_adjustment',
                      'restock'
                    )),
  reference_type    VARCHAR(50),  -- always 'order_item' for POS deductions
  reference_id      UUID,         -- order_items.id
  note              TEXT,
  created_by        UUID          REFERENCES users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_txn_item_created
  ON inventory_transactions(inventory_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inv_txn_reference
  ON inventory_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inv_txn_restaurant
  ON inventory_transactions(restaurant_id);
