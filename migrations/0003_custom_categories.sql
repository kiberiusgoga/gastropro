-- Migration: 0003_custom_categories
-- Description: Multi-category menu items + i18n support for menu_categories
-- Safe to re-run: ADD COLUMN IF NOT EXISTS + ON CONFLICT DO NOTHING

-- Extend menu_categories with i18n, icons, and type guard
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS type             VARCHAR(20)  NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS name_translations JSONB,
  ADD COLUMN IF NOT EXISTS icon             VARCHAR(50),
  ADD COLUMN IF NOT EXISTS color            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- Mark all pre-existing rows as protected system categories
UPDATE menu_categories SET type = 'system' WHERE type IS DISTINCT FROM 'system';

-- Junction table: one menu item can belong to multiple categories,
-- with an optional per-category price override and display sort order.
CREATE TABLE IF NOT EXISTS menu_item_categories (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id   UUID         NOT NULL REFERENCES menu_items(id)      ON DELETE CASCADE,
  category_id    UUID         NOT NULL REFERENCES menu_categories(id)  ON DELETE CASCADE,
  price_override DECIMAL(10,2),
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  UNIQUE (menu_item_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_mic_category ON menu_item_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_mic_item     ON menu_item_categories(menu_item_id);

-- Migrate existing single-category assignments into the junction table
INSERT INTO menu_item_categories (menu_item_id, category_id)
SELECT mi.id, mi.menu_category_id
FROM menu_items mi
WHERE mi.menu_category_id IS NOT NULL
ON CONFLICT (menu_item_id, category_id) DO NOTHING;
