-- Step 1: Extend menu_categories table
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS type           VARCHAR(20)  NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS name_translations JSONB,
  ADD COLUMN IF NOT EXISTS icon           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS color          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- All pre-existing rows are system categories (protected)
UPDATE menu_categories SET type = 'system' WHERE type IS DISTINCT FROM 'system';

-- Seed translations for the 8 known system categories
UPDATE menu_categories SET name_translations = '{"mk":"Пици","en":"Pizzas","sq":"Pica"}'         WHERE name ILIKE 'Пица%'    OR name ILIKE 'Pizza%';
UPDATE menu_categories SET name_translations = '{"mk":"Тестенини","en":"Pasta","sq":"Makarona"}' WHERE name ILIKE 'Тестен%'  OR name ILIKE 'Pasta%';
UPDATE menu_categories SET name_translations = '{"mk":"Месо","en":"Meat","sq":"Mish"}'           WHERE name ILIKE 'Месо%'    OR name ILIKE 'Meat%';
UPDATE menu_categories SET name_translations = '{"mk":"Риба","en":"Fish","sq":"Peshk"}'          WHERE name ILIKE 'Риба%'    OR name ILIKE 'Fish%';
UPDATE menu_categories SET name_translations = '{"mk":"Салати","en":"Salads","sq":"Sallata"}'    WHERE name ILIKE 'Салат%'   OR name ILIKE 'Salad%';
UPDATE menu_categories SET name_translations = '{"mk":"Пијалаци","en":"Drinks","sq":"Pije"}'    WHERE name ILIKE 'Пијал%'   OR name ILIKE 'Drink%';
UPDATE menu_categories SET name_translations = '{"mk":"Десерти","en":"Desserts","sq":"Ëmbëlsira"}' WHERE name ILIKE 'Десерт%' OR name ILIKE 'Dessert%';
UPDATE menu_categories SET name_translations = '{"mk":"Супи","en":"Soups","sq":"Supa"}'         WHERE name ILIKE 'Супа%'    OR name ILIKE 'Soup%';

-- Step 2: Junction table — item can belong to multiple categories
CREATE TABLE IF NOT EXISTS menu_item_categories (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id    UUID         NOT NULL REFERENCES menu_items(id)     ON DELETE CASCADE,
  category_id     UUID         NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  price_override  DECIMAL(10,2),
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  UNIQUE (menu_item_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_mic_category ON menu_item_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_mic_item     ON menu_item_categories(menu_item_id);

-- Step 3: Migrate existing single-category assignments into the junction table
INSERT INTO menu_item_categories (menu_item_id, category_id)
SELECT mi.id, mi.menu_category_id
FROM menu_items mi
WHERE mi.menu_category_id IS NOT NULL
ON CONFLICT (menu_item_id, category_id) DO NOTHING;
