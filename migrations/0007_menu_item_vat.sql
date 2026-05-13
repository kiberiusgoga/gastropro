BEGIN;

-- Add vat_rate column to menu_items.
-- Stored as decimal fraction: 0.18 means 18%, 0.10 means 10%, 0.05 means 5%.
-- Decimal precision allows future flexibility (e.g., 0.075 for 7.5%) without
-- schema change.
--
-- Default 0.10 reflects North Macedonia's hospitality industry standard
-- (food and non-alcoholic beverages served in restaurants/cafes).
--
-- price_includes_vat is per-restaurant, not per-item. Stored on restaurants
-- table since this is a business-wide convention. Default TRUE per local
-- standard (gross prices on menus).

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10
  CHECK (vat_rate >= 0 AND vat_rate <= 1);

COMMENT ON COLUMN menu_items.vat_rate IS
  'VAT rate as decimal fraction. 0.18 = 18%, 0.10 = 10%, 0.05 = 5%, 0.00 = exempt.';

-- Add price_includes_vat to restaurants (business-level convention).
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS price_includes_vat BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN restaurants.price_includes_vat IS
  'TRUE: menu prices are gross (VAT-inclusive, North Macedonia standard).
   FALSE: menu prices are net (VAT added at checkout).';

-- Index for VAT reporting queries (Z-report aggregates by vat_rate).
CREATE INDEX IF NOT EXISTS idx_menu_items_vat_rate
  ON menu_items(restaurant_id, vat_rate);

-- Backfill existing items with sensible defaults based on category name.
-- This is a heuristic — restaurant owners should review and adjust.
-- The pattern: alcoholic beverages and tobacco get 18%, everything else 10%.
UPDATE menu_items mi
SET vat_rate = 0.18
WHERE EXISTS (
  SELECT 1 FROM menu_categories mc
  WHERE mc.id = mi.menu_category_id
    AND (
      LOWER(mc.name) LIKE '%алкохол%' OR
      LOWER(mc.name) LIKE '%вино%' OR
      LOWER(mc.name) LIKE '%пиво%' OR
      LOWER(mc.name) LIKE '%жесток%' OR
      LOWER(mc.name) LIKE '%alcohol%' OR
      LOWER(mc.name) LIKE '%wine%' OR
      LOWER(mc.name) LIKE '%beer%' OR
      LOWER(mc.name) LIKE '%spirits%'
    )
);

-- Specifically tag well-known alcoholic items by name (defensive —
-- some categories may not be tagged correctly).
UPDATE menu_items
SET vat_rate = 0.18
WHERE LOWER(name) LIKE '%вино%'
   OR LOWER(name) LIKE '%пиво%'
   OR LOWER(name) LIKE '%виски%'
   OR LOWER(name) LIKE '%водка%'
   OR LOWER(name) LIKE '%ракија%'
   OR LOWER(name) LIKE '%коктел%'
   OR LOWER(name) LIKE '%коњак%';

-- Order_items also need vat_rate snapshot at time of order.
-- Critical: when a menu_item's VAT rate changes (e.g., regulation update),
-- existing orders must keep their original VAT rate for accurate historical
-- reporting. We snapshot at order creation, never recalculate retroactively.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4)
  CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 1));

COMMENT ON COLUMN order_items.vat_rate IS
  'VAT rate snapshot at time of order. NULL for pre-migration orders
   (assume restaurant default for those). Never updated after order creation.';

-- Backfill existing order_items with the menu_item's current vat_rate.
-- Imperfect (we don't know the historical rate), but better than NULL
-- for analytics. Real production data will fill in correctly going forward.
UPDATE order_items oi
SET vat_rate = mi.vat_rate
FROM menu_items mi
WHERE oi.menu_item_id = mi.id
  AND oi.vat_rate IS NULL;

COMMIT;
