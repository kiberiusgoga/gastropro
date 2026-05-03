-- Demo seed for GastroPro
-- Restaurant: 4567f890-ab9c-44bb-aa7e-a131ba2f841e
-- Admin user:  8151c1ec-a8ea-40b8-b4ce-692698c1914d

DO $$
DECLARE
  rid UUID := '4567f890-ab9c-44bb-aa7e-a131ba2f841e';
  uid UUID := '8151c1ec-a8ea-40b8-b4ce-692698c1914d';

  -- menu category ids
  cat_drinks    UUID;
  cat_appetizer UUID;
  cat_main      UUID;
  cat_pizza     UUID;
  cat_burger    UUID;
  cat_dessert   UUID;

  -- inventory category ids
  inv_raw       UUID;
  inv_bev       UUID;
  inv_food      UUID;
  inv_clean     UUID;

  -- shift & table ids
  shift_id      UUID;
  tbl1_id       UUID;
  tbl2_id       UUID;
  tbl3_id       UUID;

  -- order ids
  ord1_id       UUID;
  ord2_id       UUID;
  ord3_id       UUID;

  -- menu item ids (for orders)
  mi_cola       UUID;
  mi_beer       UUID;
  mi_water      UUID;
  mi_coffee     UUID;
  mi_soup       UUID;
  mi_salad      UUID;
  mi_steak      UUID;
  mi_chicken    UUID;
  mi_pasta      UUID;
  mi_margherita UUID;
  mi_burger     UUID;
  mi_tiramisu   UUID;

BEGIN

-- =============================================
-- 1. MENU CATEGORIES
-- =============================================
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Пијалоци',      1) RETURNING id INTO cat_drinks;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Предјадења',    2) RETURNING id INTO cat_appetizer;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Главни јадења', 3) RETURNING id INTO cat_main;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Пици',          4) RETURNING id INTO cat_pizza;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Бургери',       5) RETURNING id INTO cat_burger;
INSERT INTO menu_categories (restaurant_id, name, sort_order)
  VALUES (rid, 'Десерти',       6) RETURNING id INTO cat_dessert;

-- =============================================
-- 2. MENU ITEMS
-- =============================================

-- Drinks
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Кока Кола 0.33l',    120, 'bar') RETURNING id INTO mi_cola;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Пиво 0.5l',           150, 'bar') RETURNING id INTO mi_beer;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Вода 0.5l',            80, 'bar') RETURNING id INTO mi_water;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Сок од портокал',     110, 'bar');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Вино (чаша)',          200, 'bar');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Кафе еспресо',         100, 'bar') RETURNING id INTO mi_coffee;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Капучино',             130, 'bar');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_drinks, 'Чај',                   90, 'bar');

-- Appetizers
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Пилешка чорба',    200, 'kitchen') RETURNING id INTO mi_soup;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Грчка салата',      250, 'kitchen') RETURNING id INTO mi_salad;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Брускети',          220, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_appetizer, 'Хумус со питка',   280, 'kitchen');

-- Main dishes
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Телешки стек 250g',     650, 'kitchen') RETURNING id INTO mi_steak;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Пилешки гради',         480, 'kitchen') RETURNING id INTO mi_chicken;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Паста Карбонара',        420, 'kitchen') RETURNING id INTO mi_pasta;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Ризото со печурки',      450, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Свинско ребра',          550, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_main, 'Риба на скара',          700, 'kitchen');

-- Pizza
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Маргарита',             350, 'kitchen') RETURNING id INTO mi_margherita;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Капричоза',             420, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Четири сирења',         450, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_pizza, 'Пеперони',              420, 'kitchen');

-- Burgers
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_burger, 'Класичен бургер',      380, 'kitchen') RETURNING id INTO mi_burger;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_burger, 'Чикен бургер',         360, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_burger, 'Дабл смаш бургер',     480, 'kitchen');

-- Desserts
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_dessert, 'Тирамису',            250, 'kitchen') RETURNING id INTO mi_tiramisu;
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_dessert, 'Палачинки со нутела', 180, 'kitchen');
INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, preparation_station)
  VALUES (rid, cat_dessert, 'Сладолед 3 топки',    150, 'kitchen');

-- =============================================
-- 3. INVENTORY CATEGORIES
-- =============================================
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Суровини')   RETURNING id INTO inv_raw;
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Пијалоци')   RETURNING id INTO inv_bev;
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Намирници')  RETURNING id INTO inv_food;
INSERT INTO categories (restaurant_id, name) VALUES (rid, 'Хигиена')    RETURNING id INTO inv_clean;

-- =============================================
-- 4. PRODUCTS (Inventory)
-- =============================================

-- Суровини
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Брашно',        'kg',  40,    0,  50,  10);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Шеќер',         'kg',  60,    0,  30,   5);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Масло',          'l',  120,   0,  20,   5);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_raw, 'Сол',           'kg',  15,    0,  10,   2);

-- Пијалоци
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Кока Кола 0.33l', 'pcs', 45,  120, 100,  24);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Пиво 0.5l',       'pcs', 70,  150,  80,  20);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Вода 0.5l',        'pcs', 25,   80, 150,  30);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_bev, 'Сок (1l)',          'pcs', 90,  200,  40,  12);

-- Намирници
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Пилешко месо',   'kg', 200,   0,  15,   3);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Говедско месо',  'kg', 350,   0,  10,   2);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Свинско месо',   'kg', 250,   0,  12,   3);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Сирење',          'kg', 300,   0,   8,   2);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Домати',          'kg',  80,   0,   5,   1);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_food, 'Тестенини',       'kg',  90,   0,  20,   5);

-- Хигиена
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_clean, 'Детергент',    'pcs', 120,   0,  10,   2);
INSERT INTO products (restaurant_id, category_id, name, unit, purchase_price, selling_price, current_stock, min_stock)
  VALUES (rid, inv_clean, 'Хартиени крпи','box', 200,   0,   5,   2);

-- =============================================
-- 5. ACTIVE SHIFT (for POS/Kitchen to work)
-- =============================================
INSERT INTO shifts (restaurant_id, user_id, initial_cash, status)
  VALUES (rid, uid, 5000, 'open')
  RETURNING id INTO shift_id;

-- Mark shift in localStorage simulation — just store it
RAISE NOTICE 'Shift ID: %', shift_id;

-- =============================================
-- 6. GET TABLE IDs
-- =============================================
SELECT id INTO tbl1_id FROM restaurant_tables
  WHERE restaurant_id = rid AND number = '1';
SELECT id INTO tbl2_id FROM restaurant_tables
  WHERE restaurant_id = rid AND number = '3';
SELECT id INTO tbl3_id FROM restaurant_tables
  WHERE restaurant_id = rid AND number = '5';

-- =============================================
-- 7. DEMO ORDERS (for Kitchen Display)
-- =============================================

-- Order on Table 1
INSERT INTO orders (restaurant_id, table_id, user_id, shift_id, order_type, status, subtotal, total_amount, guest_count)
  VALUES (rid, tbl1_id, uid, shift_id, 'dine_in', 'open', 1100, 1100, 2)
  RETURNING id INTO ord1_id;

INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord1_id, mi_soup,    'Пилешка чорба',   2, 200, 'preparing', 'kitchen');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord1_id, mi_steak,   'Телешки стек 250g', 1, 650, 'pending', 'kitchen');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord1_id, mi_cola,    'Кока Кола 0.33l', 2, 120, 'ready',   'bar');

UPDATE restaurant_tables SET status = 'occupied' WHERE id = tbl1_id;

-- Order on Table 3
INSERT INTO orders (restaurant_id, table_id, user_id, shift_id, order_type, status, subtotal, total_amount, guest_count)
  VALUES (rid, tbl2_id, uid, shift_id, 'dine_in', 'open', 1110, 1110, 4)
  RETURNING id INTO ord2_id;

INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord2_id, mi_margherita,'Маргарита',      2, 350, 'preparing', 'kitchen');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord2_id, mi_burger,   'Класичен бургер', 1, 380, 'pending',   'kitchen');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord2_id, mi_beer,     'Пиво 0.5l',       2, 150, 'ready',     'bar');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord2_id, mi_water,    'Вода 0.5l',       2,  80, 'ready',     'bar');

UPDATE restaurant_tables SET status = 'occupied' WHERE id = tbl2_id;

-- Order on Table 5 (takeaway)
INSERT INTO orders (restaurant_id, table_id, user_id, shift_id, order_type, status, subtotal, total_amount, guest_count)
  VALUES (rid, tbl3_id, uid, shift_id, 'dine_in', 'open', 730, 730, 2)
  RETURNING id INTO ord3_id;

INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord3_id, mi_chicken, 'Пилешки гради',   1, 480, 'preparing', 'kitchen');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord3_id, mi_pasta,   'Паста Карбонара', 1, 420, 'pending',   'kitchen');
INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status, preparation_station)
  VALUES (ord3_id, mi_coffee,  'Кафе еспресо',    2, 100, 'ready',     'bar');

UPDATE restaurant_tables SET status = 'occupied' WHERE id = tbl3_id;

RAISE NOTICE 'Demo data inserted successfully!';
RAISE NOTICE 'Shift ID: %', shift_id;
RAISE NOTICE 'Orders: %, %, %', ord1_id, ord2_id, ord3_id;

END $$;
