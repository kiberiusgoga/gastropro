-- Seed: 03_full_demo
-- Description: Suppliers, purchase orders, CRM customers, reservations,
--              inventory transactions, inventory checks, and extra staff users.
-- Requires: 01_demo_restaurant.sql
-- Guard: skips if suppliers already exist for this restaurant.

DO $$
DECLARE
  rid UUID := '4567f890-ab9c-44bb-aa7e-a131ba2f841e';
  uid UUID := '8151c1ec-a8ea-40b8-b4ce-692698c1914d';

  uid_manager UUID;
  uid_worker  UUID;

  sup1_id UUID; sup2_id UUID; sup3_id UUID; sup4_id UUID;
  po1_id  UUID; po2_id  UUID; po3_id  UUID; po4_id  UUID;

  cust1_id UUID; cust2_id UUID; cust3_id UUID; cust4_id UUID;
  cust5_id UUID; cust6_id UUID; cust7_id UUID; cust8_id UUID;

  tbl1_id UUID; tbl2_id UUID; tbl3_id UUID; tbl4_id UUID; tbl5_id UUID;

  prod_brashno   UUID; prod_sheqer    UUID; prod_maslo     UUID; prod_sol      UUID;
  prod_cola      UUID; prod_pivo      UUID; prod_voda      UUID; prod_sok      UUID;
  prod_piletina  UUID; prod_govedsko  UUID; prod_svinsko   UUID;
  prod_sirenje   UUID; prod_domati    UUID; prod_testenini UUID;
  prod_detergent UUID; prod_hartija   UUID;

  chk1_id UUID; chk2_id UUID;
  sup_count INT;

BEGIN
  -- Guard
  SELECT COUNT(*) INTO sup_count FROM suppliers WHERE restaurant_id = rid;
  IF sup_count > 0 THEN
    RAISE NOTICE 'Seed 03 skipped — % suppliers already exist.', sup_count;
    RETURN;
  END IF;

  -- ============================================================
  -- 1. EXTRA STAFF USERS  (password: admin123)
  -- ============================================================
  INSERT INTO users (restaurant_id, name, email, password_hash, role)
    VALUES (rid, 'Marko Menager', 'marko@gastropro.mk',
            crypt('admin123', gen_salt('bf', 10)), 'Manager')
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO uid_manager;
  IF uid_manager IS NULL THEN
    SELECT id INTO uid_manager FROM users WHERE email = 'marko@gastropro.mk';
  END IF;

  INSERT INTO users (restaurant_id, name, email, password_hash, role)
    VALUES (rid, 'Petar Skladistar', 'petar@gastropro.mk',
            crypt('admin123', gen_salt('bf', 10)), 'Warehouse Worker')
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO uid_worker;
  IF uid_worker IS NULL THEN
    SELECT id INTO uid_worker FROM users WHERE email = 'petar@gastropro.mk';
  END IF;

  -- ============================================================
  -- 2. FETCH PRODUCT IDs
  -- ============================================================
  SELECT id INTO prod_brashno   FROM products WHERE restaurant_id = rid AND name = 'Брашно'          LIMIT 1;
  SELECT id INTO prod_sheqer    FROM products WHERE restaurant_id = rid AND name = 'Шеќер'           LIMIT 1;
  SELECT id INTO prod_maslo     FROM products WHERE restaurant_id = rid AND name = 'Масло'            LIMIT 1;
  SELECT id INTO prod_sol       FROM products WHERE restaurant_id = rid AND name = 'Сол'              LIMIT 1;
  SELECT id INTO prod_cola      FROM products WHERE restaurant_id = rid AND name = 'Кока Кола 0.33l'  LIMIT 1;
  SELECT id INTO prod_pivo      FROM products WHERE restaurant_id = rid AND name = 'Пиво 0.5l'        LIMIT 1;
  SELECT id INTO prod_voda      FROM products WHERE restaurant_id = rid AND name = 'Вода 0.5l'        LIMIT 1;
  SELECT id INTO prod_sok       FROM products WHERE restaurant_id = rid AND name = 'Сок (1l)'         LIMIT 1;
  SELECT id INTO prod_piletina  FROM products WHERE restaurant_id = rid AND name = 'Пилешко месо'     LIMIT 1;
  SELECT id INTO prod_govedsko  FROM products WHERE restaurant_id = rid AND name = 'Говедско месо'    LIMIT 1;
  SELECT id INTO prod_svinsko   FROM products WHERE restaurant_id = rid AND name = 'Свинско месо'     LIMIT 1;
  SELECT id INTO prod_sirenje   FROM products WHERE restaurant_id = rid AND name = 'Сирење'           LIMIT 1;
  SELECT id INTO prod_domati    FROM products WHERE restaurant_id = rid AND name = 'Домати'           LIMIT 1;
  SELECT id INTO prod_testenini FROM products WHERE restaurant_id = rid AND name = 'Тестенини'        LIMIT 1;
  SELECT id INTO prod_detergent FROM products WHERE restaurant_id = rid AND name = 'Детергент'        LIMIT 1;
  SELECT id INTO prod_hartija   FROM products WHERE restaurant_id = rid AND name = 'Хартиени крпи'    LIMIT 1;

  -- ============================================================
  -- 3. SUPPLIERS
  -- ============================================================
  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address)
    VALUES (rid, 'Makprogres', 'Ivan Trajkov', '+389 2 3001 000',
            'ivan@makprogres.mk', 'Bul. ASNOM 12, Skopje')
    RETURNING id INTO sup1_id;

  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address)
    VALUES (rid, 'Frikomerc', 'Saso Petrovski', '+389 2 2777 000',
            'saso@frikomerc.mk', 'Ul. Naroden Front 8, Skopje')
    RETURNING id INTO sup2_id;

  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address)
    VALUES (rid, 'Vitalia', 'Marija Stojanova', '+389 70 200 300',
            'marija@vitalia.mk', 'Industriska zona, Stip')
    RETURNING id INTO sup3_id;

  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address)
    VALUES (rid, 'Pivara Skopje', 'Goran Nikolic', '+389 2 3115 999',
            'goran@pivaraskopje.mk', 'Ul. Skupi 1, Skopje')
    RETURNING id INTO sup4_id;

  -- ============================================================
  -- 4. PURCHASE ORDERS
  -- ============================================================
  INSERT INTO purchase_orders
    (restaurant_id, supplier_id, supplier_name, order_date, expected_date,
     total_cost, status, notes)
    VALUES (rid, sup1_id, 'Makprogres',
            CURRENT_DATE - 15, CURRENT_DATE - 10, 13000, 'received',
            'Regular monthly order')
    RETURNING id INTO po1_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total)
    VALUES (po1_id, prod_brashno,   'Brasno',    100, 40,  4000),
           (po1_id, prod_sheqer,    'Secer',      50, 60,  3000),
           (po1_id, prod_maslo,     'Maslo',       25, 120, 3000),
           (po1_id, prod_sol,       'Sol',          20, 15,   300),
           (po1_id, prod_testenini, 'Testenini',   30, 90,  2700);

  INSERT INTO purchase_orders
    (restaurant_id, supplier_id, supplier_name, order_date, expected_date,
     total_cost, status, notes)
    VALUES (rid, sup4_id, 'Pivara Skopje',
            CURRENT_DATE - 5, CURRENT_DATE + 2, 8400, 'ordered',
            'Weekend order')
    RETURNING id INTO po2_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total)
    VALUES (po2_id, prod_pivo, 'Pivo 0.5l', 120, 70, 8400);

  INSERT INTO purchase_orders
    (restaurant_id, supplier_id, supplier_name, order_date, expected_date,
     total_cost, status, notes)
    VALUES (rid, sup3_id, 'Vitalia',
            CURRENT_DATE, CURRENT_DATE + 7, 11250, 'draft',
            'In preparation')
    RETURNING id INTO po3_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total)
    VALUES (po3_id, prod_piletina, 'Piletina', 20, 200, 4000),
           (po3_id, prod_govedsko, 'Govedsko', 10, 350, 3500),
           (po3_id, prod_svinsko,  'Svinsko',  15, 250, 3750);

  INSERT INTO purchase_orders
    (restaurant_id, supplier_id, supplier_name, order_date, expected_date,
     total_cost, status, notes)
    VALUES (rid, sup2_id, 'Frikomerc',
            CURRENT_DATE - 8, CURRENT_DATE - 3, 2600, 'cancelled',
            'Cancelled — products unavailable')
    RETURNING id INTO po4_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total)
    VALUES (po4_id, prod_detergent, 'Detergent',    10, 120, 1200),
           (po4_id, prod_hartija,   'Hartieni krpi',  7, 200, 1400);

  -- ============================================================
  -- 5. CUSTOMERS (CRM)
  -- ============================================================
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Aleksandar Stojanovski', '+389 70 123 456', 'aleksandar@gmail.com',
            'Regular guest, prefers window table', 12400, 18)
    RETURNING id INTO cust1_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Marina Petrovska', '+389 71 234 567', 'marina@hotmail.com',
            'Vegetarian', 8700, 12)
    RETURNING id INTO cust2_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Bojan Gorgieski', '+389 72 345 678', 'bojan@yahoo.com',
            'Nut allergy!', 21500, 31)
    RETURNING id INTO cust3_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Ivana Nikolova', '+389 75 456 789', 'ivana.nikolova@gmail.com',
            'Prefers quiet table', 5300, 7)
    RETURNING id INTO cust4_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Stefan Trajkovski', '+389 76 567 890', NULL,
            'Business lunches every Wednesday', 34200, 45)
    RETURNING id INTO cust5_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Ana Jovanovska', '+389 77 678 901', 'ana.j@gmail.com',
            NULL, 3100, 4)
    RETURNING id INTO cust6_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Goran Mitevski', '+389 78 789 012', 'goran.m@outlook.com',
            'Often orders for whole team — 8+ people', 67800, 52)
    RETURNING id INTO cust7_id;
  INSERT INTO customers (restaurant_id, name, phone, email, notes, total_spent, orders_count)
    VALUES (rid, 'Lence Ristovska', '+389 70 890 123', NULL,
            'Birthday: 15 March', 9200, 14)
    RETURNING id INTO cust8_id;

  -- ============================================================
  -- 6. TABLE IDs
  -- ============================================================
  SELECT id INTO tbl1_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '1';
  SELECT id INTO tbl2_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '2';
  SELECT id INTO tbl3_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '4';
  SELECT id INTO tbl4_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '6';
  SELECT id INTO tbl5_id FROM restaurant_tables WHERE restaurant_id = rid AND number = '8';

  -- ============================================================
  -- 7. RESERVATIONS
  -- ============================================================
  -- Upcoming
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust1_id, 'Aleksandar Stojanovski', '+389 70 123 456',
            tbl2_id, '2', CURRENT_DATE + 1, '19:30', 2, 'Anniversary dinner', 'reserved');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust5_id, 'Stefan Trajkovski', '+389 76 567 890',
            tbl3_id, '4', CURRENT_DATE + 1, '12:00', 6, 'Business lunch, projector needed', 'reserved');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust7_id, 'Goran Mitevski', '+389 78 789 012',
            tbl4_id, '6', CURRENT_DATE + 2, '20:00', 8, 'Birthday celebration', 'reserved');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust3_id, 'Bojan Gorgieski', '+389 72 345 678',
            tbl1_id, '1', CURRENT_DATE + 3, '13:00', 3, 'Nut allergy!', 'reserved');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust8_id, 'Lence Ristovska', '+389 70 890 123',
            tbl5_id, '8', CURRENT_DATE + 4, '18:30', 4, NULL, 'reserved');
  -- Today
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust2_id, 'Marina Petrovska', '+389 71 234 567',
            tbl2_id, '2', CURRENT_DATE, '12:30', 2, 'Vegetarian menu', 'arrived');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust6_id, 'Ana Jovanovska', '+389 77 678 901',
            tbl1_id, '1', CURRENT_DATE, '19:00', 3, NULL, 'reserved');
  -- Past
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust4_id, 'Ivana Nikolova', '+389 75 456 789',
            tbl3_id, '4', CURRENT_DATE - 2, '20:00', 2, 'Quiet table', 'completed');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, cust1_id, 'Aleksandar Stojanovski', '+389 70 123 456',
            tbl1_id, '1', CURRENT_DATE - 5, '13:00', 4, NULL, 'completed');
  INSERT INTO reservations (restaurant_id, customer_id, customer_name, customer_phone,
                             table_id, table_number, date, time, number_of_guests, notes, status)
    VALUES (rid, NULL, 'Unknown Guest', '+389 70 000 000',
            tbl2_id, '2', CURRENT_DATE - 1, '21:00', 2, 'No-show', 'cancelled');

  -- ============================================================
  -- 8. INVENTORY TRANSACTIONS
  -- ============================================================
  INSERT INTO transactions (restaurant_id, product_id, type, quantity, previous_stock, new_stock, user_id, note)
    VALUES
    (rid, prod_brashno,   'receipt',  50,  0,  50, uid, 'Initial stock'),
    (rid, prod_sheqer,    'receipt',  30,  0,  30, uid, 'Initial stock'),
    (rid, prod_maslo,     'receipt',  20,  0,  20, uid, 'Initial stock'),
    (rid, prod_sol,       'receipt',  10,  0,  10, uid, 'Initial stock'),
    (rid, prod_cola,      'receipt', 100,  0, 100, uid, 'Initial stock'),
    (rid, prod_pivo,      'receipt',  80,  0,  80, uid, 'Initial stock'),
    (rid, prod_voda,      'receipt', 150,  0, 150, uid, 'Initial stock'),
    (rid, prod_sok,       'receipt',  40,  0,  40, uid, 'Initial stock'),
    (rid, prod_piletina,  'receipt',  15,  0,  15, uid, 'Initial stock'),
    (rid, prod_govedsko,  'receipt',  10,  0,  10, uid, 'Initial stock'),
    (rid, prod_svinsko,   'receipt',  12,  0,  12, uid, 'Initial stock'),
    (rid, prod_sirenje,   'receipt',   8,  0,   8, uid, 'Initial stock'),
    (rid, prod_domati,    'receipt',   5,  0,   5, uid, 'Initial stock'),
    (rid, prod_testenini, 'receipt',  20,  0,  20, uid, 'Initial stock'),
    (rid, prod_detergent, 'receipt',  10,  0,  10, uid, 'Initial stock'),
    (rid, prod_hartija,   'receipt',   5,  0,   5, uid, 'Initial stock');

  INSERT INTO transactions (restaurant_id, product_id, type, quantity, previous_stock, new_stock, user_id, note, date)
    VALUES
    (rid, prod_brashno,  'input', 100, 36, 136, uid_worker, 'Receipt — Makprogres order', NOW() - INTERVAL '10 days'),
    (rid, prod_sheqer,   'input',  50, 25,  75, uid_worker, 'Receipt — Makprogres order', NOW() - INTERVAL '10 days'),
    (rid, prod_maslo,    'input',  25, 17,  42, uid_worker, 'Receipt — Makprogres order', NOW() - INTERVAL '10 days'),
    (rid, prod_testenini,'input',  30, 20,  50, uid_worker, 'Receipt — Makprogres order', NOW() - INTERVAL '10 days'),
    (rid, prod_brashno,  'output',  8, 50,  42, uid_manager, 'Daily usage', NOW() - INTERVAL '7 days'),
    (rid, prod_maslo,    'output',  3, 20,  17, uid_manager, 'Daily usage', NOW() - INTERVAL '7 days'),
    (rid, prod_piletina, 'output',  4, 15,  11, uid_manager, 'Daily usage', NOW() - INTERVAL '6 days'),
    (rid, prod_govedsko, 'output',  2, 10,   8, uid_manager, 'Daily usage', NOW() - INTERVAL '6 days'),
    (rid, prod_cola,     'output', 24, 100,  76, uid_worker,  'Sales',       NOW() - INTERVAL '5 days'),
    (rid, prod_pivo,     'output', 20,  80,  60, uid_worker,  'Sales',       NOW() - INTERVAL '5 days'),
    (rid, prod_voda,     'output', 30, 150, 120, uid_worker,  'Sales',       NOW() - INTERVAL '4 days'),
    (rid, prod_brashno,  'output',  6,  42,  36, uid_manager, 'Daily usage', NOW() - INTERVAL '4 days'),
    (rid, prod_sheqer,   'output',  5,  30,  25, uid_manager, 'Daily usage', NOW() - INTERVAL '3 days'),
    (rid, prod_piletina, 'output',  3,  11,   8, uid_manager, 'Daily usage', NOW() - INTERVAL '3 days'),
    (rid, prod_svinsko,  'output',  4,  12,   8, uid_manager, 'Daily usage', NOW() - INTERVAL '2 days'),
    (rid, prod_cola,     'output', 16,  76,  60, uid_worker,  'Sales',       NOW() - INTERVAL '1 day'),
    (rid, prod_pivo,     'output', 12,  60,  48, uid_worker,  'Sales',       NOW() - INTERVAL '1 day');

  -- ============================================================
  -- 9. INVENTORY CHECKS
  -- ============================================================
  INSERT INTO inventory_checks (restaurant_id, user_id, date, status)
    VALUES (rid, uid_manager, NOW() - INTERVAL '7 days', 'completed')
    RETURNING id INTO chk1_id;
  INSERT INTO inventory_check_items (check_id, product_id, system_qty, real_qty, diff)
    VALUES (chk1_id, prod_brashno,   50,  48, -2),
           (chk1_id, prod_sheqer,    30,  30,  0),
           (chk1_id, prod_maslo,     20,  19, -1),
           (chk1_id, prod_cola,     100,  98, -2),
           (chk1_id, prod_pivo,      80,  79, -1),
           (chk1_id, prod_voda,     150, 150,  0),
           (chk1_id, prod_piletina,  15,  15,  0),
           (chk1_id, prod_govedsko,  10,   9, -1),
           (chk1_id, prod_sirenje,    8,   8,  0),
           (chk1_id, prod_testenini, 20,  20,  0);

  INSERT INTO inventory_checks (restaurant_id, user_id, date, status)
    VALUES (rid, uid, NOW(), 'draft')
    RETURNING id INTO chk2_id;
  INSERT INTO inventory_check_items (check_id, product_id, system_qty, real_qty, diff)
    VALUES (chk2_id, prod_brashno, 36, 34, -2),
           (chk2_id, prod_cola,    60, 60,  0),
           (chk2_id, prod_pivo,    48, 47, -1),
           (chk2_id, prod_voda,   120,120,  0),
           (chk2_id, prod_piletina, 8,  8,  0);

  RAISE NOTICE 'Seed 03 complete.';
  RAISE NOTICE 'Logins: admin@gastropro.mk / marko@gastropro.mk / petar@gastropro.mk  (password: admin123)';

END $$;
