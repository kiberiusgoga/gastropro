-- migrations/add_recipe_system.sql
-- Додава поддршка за нормативи (рецепти) и POS одземање на залиха.
-- Безбедно за повторно извршување (IF NOT EXISTS насекаде).
--
-- ============================================================
-- ПРАВИЛА ЗА КОНВЕРЗИЈА НА ЕДИНИЦИ  (спроведени во апликацискиот слој)
-- ============================================================
--
-- Кога одземаме, конвертираме recipe_unit → products.unit:
--
--   recipe_unit | inventory unit | фактор
--   ------------|----------------|--------
--   'g'         | 'kg'           | ÷ 1000
--   'ml'        | 'l'            | ÷ 1000
--   'kg'        | 'kg'           | × 1
--   'l'         | 'l'            | × 1
--   'pcs'       | 'pcs'          | × 1
--   'pcs'       | 'box'          | × 1   (дозволено, но со предупредување)
--   'box'       | 'box'          | × 1
--
-- Секоја друга комбинација МОРА да се одбие со:
--   "Cannot convert {recipe_unit} to {inventory_unit} for ingredient {name}"
--
-- ЗА ДОДАВАЊЕ НОВИ ЕДИНИЦИ (пр. 'oz', 'tbsp', 'cup'):
--   1. Додај нова вредност во CHECK ограничувањето подолу (нова миграција
--      со ALTER TABLE recipe_ingredients DROP CONSTRAINT + ADD CONSTRAINT).
--   2. Додај нов пар (recipe_unit, inv_unit) → фактор во UNIT_CONVERSION
--      во services/inventoryDeductionService.ts.
--   3. Ажурирај ги dozvoleni единици во RecipeTab (allowedUnitsFor функцијата).
--   Ниту еден друг файл не треба да се менува.
-- ============================================================

-- ============================================================
-- ТАБЕЛА: recipe_ingredients
-- Еден ред = еден состојок за еден артикл (нормативот).
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID          NOT NULL REFERENCES restaurants(id)  ON DELETE CASCADE,
  menu_item_id      UUID          NOT NULL REFERENCES menu_items(id)   ON DELETE CASCADE,
  -- Се поврзува со tabелата products (= inventory во оваа кодна база)
  inventory_item_id UUID          NOT NULL REFERENCES products(id)     ON DELETE RESTRICT,
  quantity          DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  -- recipe_unit = единицата во која шефот ја внесува рецептурата.
  -- Се конвертира во products.unit при одземањето (види правила погоре).
  recipe_unit       VARCHAR(10)   NOT NULL
                    CHECK (recipe_unit IN ('g', 'ml', 'kg', 'l', 'pcs', 'box')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Еден состојок (производ) по артикл — дупликати се одбиваат
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

-- ============================================================
-- ТАБЕЛА: inventory_transactions
-- Одделна од постоечката табела `transactions` (таа ги покрива
-- магацинскиот прием/расход). Оваа ги покрива само POS движења.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID          NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Производот чија залиха се изменила
  inventory_item_id UUID          NOT NULL REFERENCES products(id)   ON DELETE RESTRICT,
  -- Негативно = одземање (продажба), позитивно = враќање (откажано)
  change_amount     DECIMAL(10,3) NOT NULL,
  -- Дозволени вредности за reason:
  --   'order_completed'         – нормално одземање кога order_item → ready
  --   'low_stock_override'      – исто одземање но залихата оди под нула
  --   'order_cancelled_restore' – враќање кога ready артикл е откажан
  --   'manual_adjustment'       – за идни рачни корекции
  --   'restock'                 – за идно надополнување
  reason            VARCHAR(50)   NOT NULL,
  reference_type    VARCHAR(50),  -- секогаш 'order_item' за POS одземања
  reference_id      UUID,         -- order_items.id
  note              TEXT,
  created_by        UUID          REFERENCES users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Ефикасно пребарување на историјата на залихата по состојок
CREATE INDEX IF NOT EXISTS idx_inv_txn_item_created
  ON inventory_transactions(inventory_item_id, created_at DESC);

-- Ефикасно пребарување: „дали овој order_item веќе е одземен?"
CREATE INDEX IF NOT EXISTS idx_inv_txn_reference
  ON inventory_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inv_txn_restaurant
  ON inventory_transactions(restaurant_id);
