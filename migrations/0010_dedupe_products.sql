BEGIN;

-- ============================================================
-- Build keeper map once. keeper_map has one row per product
-- copy (48 total: 3 copies × 16 products).
--
-- Keeper selection per (restaurant_id, name) group:
--   Priority 0 — row already referenced by recipe_ingredients
--   Priority 1 — lexicographically smallest id::text (deterministic)
--
-- After this: rows where dup_id = keeper_id are the 16 keepers.
--             rows where dup_id != keeper_id are the 32 to delete.
--
-- ON COMMIT DROP ensures the temp table never leaks outside this txn.
-- ============================================================

CREATE TEMP TABLE keeper_map ON COMMIT DROP AS
SELECT
  p.id AS dup_id,
  FIRST_VALUE(p.id) OVER (
    PARTITION BY p.restaurant_id, p.name
    ORDER BY
      CASE WHEN EXISTS (
        SELECT 1 FROM recipe_ingredients ri
        WHERE ri.inventory_item_id = p.id
      ) THEN 0 ELSE 1 END,
      p.id::text
  ) AS keeper_id
FROM products p
WHERE EXISTS (
  SELECT 1 FROM products p2
  WHERE p2.restaurant_id = p.restaurant_id
    AND p2.name = p.name
    AND p2.id != p.id
);

-- ============================================================
-- Step 1: Re-point transactions.product_id
--
-- 22 rows across 11 products point to duplicate IDs.
-- These are warehouse movement records (receipts, outputs,
-- inventory checks). Re-pointing preserves full history under
-- the canonical product ID.
-- ============================================================

UPDATE transactions
SET    product_id = km.keeper_id
FROM   keeper_map km
WHERE  transactions.product_id = km.dup_id
  AND  km.dup_id != km.keeper_id;

-- ============================================================
-- Step 2: Re-point inventory_check_items.product_id
--
-- 11 rows across 7 products point to duplicate IDs.
-- inventory_check_items has no UNIQUE(check_id, product_id)
-- constraint, so re-pointing creates no collisions (verified).
-- ============================================================

UPDATE inventory_check_items
SET    product_id = km.keeper_id
FROM   keeper_map km
WHERE  inventory_check_items.product_id = km.dup_id
  AND  km.dup_id != km.keeper_id;

-- ============================================================
-- Step 3: Re-point purchase_order_items.product_id
--
-- 6 rows across 6 products point to duplicate IDs.
-- purchase_order_items has no UNIQUE(purchase_order_id, product_id)
-- constraint, so re-pointing creates no collisions (verified).
-- ============================================================

UPDATE purchase_order_items
SET    product_id = km.keeper_id
FROM   keeper_map km
WHERE  purchase_order_items.product_id = km.dup_id
  AND  km.dup_id != km.keeper_id;

-- ============================================================
-- Step 4: Sanity check — assert zero orphan FK references remain
--
-- Checks all three tables that had orphans. If any reference to
-- a soon-to-be-deleted product ID still exists, raises EXCEPTION
-- and rolls back the entire transaction before any DELETE fires.
-- ============================================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM (
    SELECT product_id
    FROM   transactions
    WHERE  product_id IN (SELECT dup_id FROM keeper_map WHERE dup_id != keeper_id)
    UNION ALL
    SELECT product_id
    FROM   inventory_check_items
    WHERE  product_id IN (SELECT dup_id FROM keeper_map WHERE dup_id != keeper_id)
    UNION ALL
    SELECT product_id
    FROM   purchase_order_items
    WHERE  product_id IN (SELECT dup_id FROM keeper_map WHERE dup_id != keeper_id)
  ) remaining;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Re-pointing incomplete: % orphan FK references remain. Migration aborted.',
      orphan_count;
  END IF;
END $$;

-- ============================================================
-- Step 5: Delete the 32 duplicate product rows
--
-- Only runs if Step 4 passed. The WHERE clause uses the same
-- keeper_map so the set of deleted IDs is identical to what
-- the dry-run verified: 32 rows, 0 recipe refs, 0 transactions.
-- ============================================================

DELETE FROM products
WHERE id IN (
  SELECT dup_id FROM keeper_map WHERE dup_id != keeper_id
);

-- ============================================================
-- Step 6: Add unique constraint to prevent recurrence
--
-- This is the real guard. The ON CONFLICT (restaurant_id, name)
-- clause added to seeds/01_demo_restaurant.sql targets this
-- constraint. POST /products maps code 23505 + this constraint
-- name to a 409 ConflictError.
-- ============================================================

ALTER TABLE products
  ADD CONSTRAINT products_restaurant_name_unique
  UNIQUE (restaurant_id, name);

COMMIT;
