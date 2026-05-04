-- Seed: 01_demo_restaurant
-- Description: Demo restaurant, admin user, menu categories/items,
--              inventory categories/products, tables, active shift,
--              and 3 open demo orders for Kitchen Display.
-- Idempotent: ON CONFLICT DO NOTHING on all inserts.
-- Fixed IDs so downstream seeds can reference them safely.
--
-- Restaurant: 4567f890-ab9c-44bb-aa7e-a131ba2f841e
-- Admin user: 8151c1ec-a8ea-40b8-b4ce-692698c1914d  (admin@gastropro.mk / admin123)

DO $$
DECLARE
  rid UUID := '4567f890-ab9c-44bb-aa7e-a131ba2f841e';
  uid UUID := '8151c1ec-a8ea-40b8-b4ce-692698c1914d';

  cat_drinks    UUID;
  cat_appetizer UUID;
  cat_main      UUID;
  cat_pizza     UUID;
  cat_burger    UUID;
  cat_dessert   UUID;

  inv_raw   UUID;
  inv_bev   UUID;
  inv_food  UUID;
  inv_clean UUID;

  shift_id UUID;
  tbl1_id  UUID;
  tbl2_id  UUID;
  tbl3_id  UUID;

  ord1_id UUID;
  ord2_id UUID;
  ord3_id UUID;

  mi_cola       UUID; mi_beer   UUID; mi_water  UUID;
  mi_coffee     UUID; mi_soup   UUID; mi_salad  UUID;
  mi_steak      UUID; mi_chicken UUID; mi_pasta UUID;
  mi_margherita UUID; mi_burger  UUID; mi_tiramisu UUID;

BEGIN

-- ============================================================
-- 1. RESTAURANT
-- ============================================================
INSERT INTO restaurants (id, name, active, address, phone, tax_number,
                         currency, timezone, subscription_plan)
  VALUES (rid, 'GastroPro Demo', TRUE,
          'Bul. Partizanski Odredi 3, Skopje',
          '+389 2 3100 000', 'MK4030123456789',
          'MKD', 'Europe/Skopje', 'pro')
  ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. ADMIN USER  (password: admin123)
-- ============================================================
INSERT INTO users (id, restaurant_id, name, email, password_hash, role, active)
  VALUES (uid, rid, 'Admin', 'admin@gastropro.mk',
          crypt('admin123', gen_salt('bf', 10)), 'Admin', TRUE)
  ON CONFLICT (email) DO UPDATE
    SET password_hash = crypt('admin123', gen_salt('bf', 10)),
        restaurant_id = rid;

-- Set owner
UPDATE restaurants SET owner_id = uid WHERE id = rid;

-- ============================================================
-- 3. MENU CATEGORIES
-- ============================================================
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Pijалоци',      1) ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Предјадења',    2) ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Главни јадења', 3) ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Пици',          4) ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Бургери',       5) ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Десерти',       6) ON CONFLICT (restaurant_id, name) DO NOTHING;

SELECT id INTO cat_drinks    FROM menu_categories WHERE restaurant_id = rid AND sort_order = 1;
SELECT id INTO cat_appetizer FROM menu_categories WHERE restaurant_id = rid AND sort_order = 2;
SELECT id INTO cat_main      FROM menu_categories WHERE restaurant_id = rid AND sort_order = 3;
SELECT id INTO cat_pizza     FROM menu_categories WHERE restaurant_id = rid AND sort_order = 4;
SELECT id INTO cat_burger    FROM menu_categories WHERE restaurant_id = rid AND sort_order = 5;
SELECT id INTO cat_dessert   FROM menu_categories WHERE restaurant_id = rid AND sort_order = 6;

-- ============================================================
-- 4. MENU ITEMS
-- ============================================================
-- Drinks
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Кока Кола 0.33l',  120, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Пиво 0.5l',         150, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Вода 0.5l',           80, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Сок од портокал',   110, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Вино (чаша)',        200, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Кафе еспресо',       100, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Капучино',           130, 'bar')    ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Чај',                 90, 'bar')    ON CONFLICT DO NOTHING;

-- Appetizers
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Пилешка чорба',  200, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Грчка салата',   250, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Брускети',        220, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Хумус со питка', 280, 'kitchen') ON CONFLICT DO NOTHING;

-- Main dishes
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Телешки стек 250g',  650, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Пилешки гради',       480, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Паста Карбонара',     420, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Ризото со печурки',   450, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Свинско ребра',        550, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Риба на скара',        700, 'kitchen') ON CONFLICT DO NOTHING;

-- Pizza
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Маргарита',           350, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Капричоза',           420, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Четири сирења',       450, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Пеперони',            420, 'kitchen') ON CONFLICT DO NOTHING;

-- Burgers
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_burger, 'Класичен бургер',   380, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_burger, 'Чикен бургер',       360, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_burger, 'Дабл смаш бургер',  480, 'kitchen') ON CONFLICT DO NOTHING;

-- Desserts
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_dessert, 'Тирамису',          250, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_dessert, 'Палачинки со нутела', 180, 'kitchen') ON CONFLICT DO NOTHING;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_dessert, 'Сладолед 3 топки',  150, 'kitchen') ON CONFLICT DO NOTHING;

SELECT id INTO mi_cola        FROM menu_items WHERE restaurant_id = rid AND name = 'Кока Кола 0.33l'  LIMIT 1;
SELECT id INTO mi_beer        FROM menu_items WHERE restaurant_id = rid AND name = 'Пиво 0.5l'         LIMIT 1;
SELECT id INTO mi_water       FROM menu_items WHERE restaurant_id = rid AND name = 'Вода 0.5l'         LIMIT 1;
SELECT id INTO mi_coffee      FROM menu_items WHERE restaurant_id = rid AND name = 'Кафе еспресо'      LIMIT 1;
SELECT id INTO mi_soup        FROM menu_items WHERE restaurant_id = rid AND name = 'Пилешка чорба'     LIMIT 1;
SELECT id INTO mi_salad       FROM menu_items WHERE restaurant_id = rid AND name = 'Грчка салата'      LIMIT 1;
SELECT id INTO mi_steak       FROM menu_items WHERE restaurant_id = rid AND name = 'Телешки стек 250g' LIMIT 1;
SELECT id INTO mi_chicken     FROM menu_items WHERE restaurant_id = rid AND name = 'Пилешки гради'     LIMIT 1;
SELECT id INTO mi_pasta       FROM menu_items WHERE restaurant_id = rid AND name = 'Паста Карбонара'   LIMIT 1;
SELECT id INTO mi_margherita  FROM menu_items WHERE restaurant_id = rid AND name = 'Маргарита'         LIMIT 1;
SELECT id INTO mi_burger      FROM menu_items WHERE restaurant_id = rid AND name = 'Класичен бургер'   LIMIT 1;
SELECT id INTO mi_tiramisu    FROM menu_items WHERE restaurant_id = rid AND name = 'Тирамису'          LIMIT 1;

-- ============================================================
-- 5. INVENTORY CATEGORIES
-- ============================================================
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Суровини')  ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Пијалоци')  ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Намирници') ON CONFLICT (restaurant_id, name) DO NOTHING;
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Хигиена')   ON CONFLICT (restaurant_id, name) DO NOTHING;

SELECT id INTO inv_raw   FROM categories WHERE restaurant_id = rid AND name = 'Суровини';
SELECT id INTO inv_bev   FROM categories WHERE restaurant_id = rid AND name = 'Пијалоци';
SELECT id INTO inv_food  FROM categories WHERE restaurant_id = rid AND name = 'Намирници';
SELECT id INTO inv_clean FROM categories WHERE restaurant_id = rid AND name = 'Хигиена';

-- ============================================================
-- 6. PRODUCTS (inventory)
-- ============================================================
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Брашно',  'kg',  40,  0, 50, 10) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Шеќер',   'kg',  60,  0, 30,  5) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Масло',    'l',  120,  0, 20,  5) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Сол',     'kg',  15,  0, 10,  2) ON CONFLICT DO NOTHING;

INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Кока Кола 0.33l', 'pcs', 45, 120, 100, 24) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Пиво 0.5l',        'pcs', 70, 150,  80, 20) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Вода 0.5l',         'pcs', 25,  80, 150, 30) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Сок (1l)',           'pcs', 90, 200,  40, 12) ON CONFLICT DO NOTHING;

INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Пилешко месо',  'kg', 200, 0, 15, 3) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Говедско месо', 'kg', 350, 0, 10, 2) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Свинско месо',  'kg', 250, 0, 12, 3) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Сирење',         'kg', 300, 0,  8, 2) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Домати',          'kg',  80, 0,  5, 1) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Тестенини',       'kg',  90, 0, 20, 5) ON CONFLICT DO NOTHING;

INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_clean, 'Детергент',     'pcs', 120, 0, 10, 2) ON CONFLICT DO NOTHING;
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_clean, 'Хартиени крпи', 'box', 200, 0,  5, 2) ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. RESTAURANT TABLES (10 tables)
-- ============================================================
INSERT INTO restaurant_tables (restaurant_id, number, capacity, zone)
  VALUES (rid, '1',  4, 'main'),  (rid, '2',  2, 'main'),
         (rid, '3',  4, 'main'),  (rid, '4',  6, 'main'),
         (rid, '5',  2, 'main'),  (rid, '6',  8, 'vip'),
         (rid, '7',  4, 'vip'),   (rid, '8',  4, 'terrace'),
         (rid, '9',  2, 'terrace'),(rid, '10', 4, 'terrace')
  ON CONFLICT (restaurant_id, number) DO NOTHING;

SELECT id INTO tbl1_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '1';
SELECT id INTO tbl2_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '3';
SELECT id INTO tbl3_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '5';

-- ============================================================
-- 8. ACTIVE SHIFT
-- ============================================================
INSERT INTO shifts (restaurant_id, user_id, initial_cash, status)
  SELECT rid, uid, 5000, 'open'
  WHERE NOT EXISTS (
    SELECT 1 FROM shifts WHERE restaurant_id = rid AND status = 'open'
  );

SELECT id INTO shift_id FROM shifts WHERE restaurant_id = rid AND status = 'open' LIMIT 1;

-- ============================================================
-- 9. OPEN DEMO ORDERS (for Kitchen Display testing)
-- ============================================================
INSERT INTO orders (restaurant_id, table_id, user_id, shift_id,
                    order_type, status, subtotal, total_amount, guest_count)
  SELECT rid, tbl1_id, uid, shift_id, 'dine_in', 'open', 1100, 1100, 2
  WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE restaurant_id = rid AND table_id = tbl1_id AND status = 'open'
  )
  RETURNING id INTO ord1_id;

IF ord1_id IS NOT NULL THEN
  INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
    VALUES (ord1_id, mi_soup,   'Пилешка чорба',    2, 200, 'preparing', 'kitchen'),
           (ord1_id, mi_steak,  'Телешки стек 250g', 1, 650, 'pending',   'kitchen'),
           (ord1_id, mi_cola,   'Кока Кола 0.33l',   2, 120, 'ready',     'bar');
  UPDATE restaurant_tables SET status = 'occupied' WHERE id = tbl1_id;
END IF;

INSERT INTO orders (restaurant_id, table_id, user_id, shift_id,
                    order_type, status, subtotal, total_amount, guest_count)
  SELECT rid, tbl2_id, uid, shift_id, 'dine_in', 'open', 1110, 1110, 4
  WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE restaurant_id = rid AND table_id = tbl2_id AND status = 'open'
  )
  RETURNING id INTO ord2_id;

IF ord2_id IS NOT NULL THEN
  INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
    VALUES (ord2_id, mi_margherita, 'Маргарита',       2, 350, 'preparing', 'kitchen'),
           (ord2_id, mi_burger,     'Класичен бургер',  1, 380, 'pending',   'kitchen'),
           (ord2_id, mi_beer,       'Пиво 0.5l',        2, 150, 'ready',     'bar'),
           (ord2_id, mi_water,      'Вода 0.5l',         2,  80, 'ready',     'bar');
  UPDATE restaurant_tables SET status = 'occupied' WHERE id = tbl2_id;
END IF;

INSERT INTO orders (restaurant_id, table_id, user_id, shift_id,
                    order_type, status, subtotal, total_amount, guest_count)
  SELECT rid, tbl3_id, uid, shift_id, 'dine_in', 'open', 730, 730, 2
  WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE restaurant_id = rid AND table_id = tbl3_id AND status = 'open'
  )
  RETURNING id INTO ord3_id;

IF ord3_id IS NOT NULL THEN
  INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
    VALUES (ord3_id, mi_chicken, 'Пилешки гради',   1, 480, 'preparing', 'kitchen'),
           (ord3_id, mi_pasta,   'Паста Карбонара',  1, 420, 'pending',   'kitchen'),
           (ord3_id, mi_coffee,  'Кафе еспресо',     2, 100, 'ready',     'bar');
  UPDATE restaurant_tables SET status = 'occupied' WHERE id = tbl3_id;
END IF;

RAISE NOTICE 'Seed 01 complete — restaurant, menu, inventory, tables, shift, demo orders.';

END $$;
