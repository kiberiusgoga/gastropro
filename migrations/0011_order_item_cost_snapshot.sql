BEGIN;

-- Add cost snapshot to order_items, parallel to existing vat_rate.
-- Frozen at order creation time. Never recalculated.
-- Reasoning: products.purchase_price is a live value that changes
-- when restaurants update their wholesale prices. Without this
-- snapshot, historical margin calculations would drift over time,
-- breaking Z-report and historical analytics accuracy.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15, 2)
    CHECK (unit_cost IS NULL OR unit_cost >= 0);

COMMENT ON COLUMN order_items.unit_cost IS
  'Cost of one unit of this menu item at the moment the order was created.
   Calculated from SUM(recipe_ingredients.quantity * products.purchase_price).
   NULL means: menu item had no recipe defined at order time.
   Immutable after order creation, parallels vat_rate snapshot pattern.';

-- Backfill existing order_items with current cost calculation.
-- This is a best-effort retrofit — for new orders going forward,
-- the cost will be snapshotted at order creation properly.
-- For existing orders, we use the CURRENT recipe and prices, which
-- may not reflect historical reality but is better than NULL.

UPDATE order_items oi
SET unit_cost = (
  SELECT COALESCE(SUM(ri.quantity * p.purchase_price), 0)
  FROM recipe_ingredients ri
  JOIN products p ON p.id = ri.inventory_item_id
  WHERE ri.menu_item_id = oi.menu_item_id
)
WHERE oi.unit_cost IS NULL
  AND oi.menu_item_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM recipe_ingredients ri
    WHERE ri.menu_item_id = oi.menu_item_id
  );

-- Note: order_items without a recipe stay NULL — correct semantics.

COMMIT;
