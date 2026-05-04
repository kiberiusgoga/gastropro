-- Seed: 02_analytics
-- Description: 165 paid orders spread over the last 30 days for analytics charts.
-- Requires: 01_demo_restaurant.sql (menu items must exist).
-- Guard: skips if paid orders already exist for this restaurant.

DO $$
DECLARE
  rid UUID := '4567f890-ab9c-44bb-aa7e-a131ba2f841e';
  uid UUID := '8151c1ec-a8ea-40b8-b4ce-692698c1914d';

  shift_id   UUID;
  ord_id     UUID;
  order_time TIMESTAMP;
  v_subtotal NUMERIC;
  day_offset INT;
  i          INT;
  num_orders INT;
  paid_count INT;

  mi_cola          UUID; mi_beer         UUID; mi_water      UUID;
  mi_coffee        UUID; mi_wine         UUID; mi_juice      UUID;
  mi_soup          UUID; mi_salad        UUID;
  mi_steak         UUID; mi_chicken      UUID; mi_pasta      UUID;
  mi_ribs          UUID; mi_risotto      UUID;
  mi_margherita    UUID; mi_pepperoni    UUID; mi_quattro    UUID;
  mi_burger        UUID; mi_chicken_burger UUID; mi_smash    UUID;
  mi_tiramisu      UUID; mi_pancakes     UUID;

BEGIN
  -- Guard: skip if analytics data already exists
  SELECT COUNT(*) INTO paid_count
    FROM orders WHERE restaurant_id = rid AND status = 'paid';
  IF paid_count > 0 THEN
    RAISE NOTICE 'Seed 02 skipped — % paid orders already exist.', paid_count;
    RETURN;
  END IF;

  SELECT id INTO shift_id FROM shifts
    WHERE restaurant_id = rid ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO mi_cola          FROM menu_items WHERE restaurant_id = rid AND name = 'Кока Кола 0.33l'    LIMIT 1;
  SELECT id INTO mi_beer          FROM menu_items WHERE restaurant_id = rid AND name = 'Пиво 0.5l'           LIMIT 1;
  SELECT id INTO mi_water         FROM menu_items WHERE restaurant_id = rid AND name = 'Вода 0.5l'           LIMIT 1;
  SELECT id INTO mi_coffee        FROM menu_items WHERE restaurant_id = rid AND name = 'Кафе еспресо'        LIMIT 1;
  SELECT id INTO mi_wine          FROM menu_items WHERE restaurant_id = rid AND name = 'Вино (чаша)'         LIMIT 1;
  SELECT id INTO mi_juice         FROM menu_items WHERE restaurant_id = rid AND name = 'Сок од портокал'     LIMIT 1;
  SELECT id INTO mi_soup          FROM menu_items WHERE restaurant_id = rid AND name = 'Пилешка чорба'       LIMIT 1;
  SELECT id INTO mi_salad         FROM menu_items WHERE restaurant_id = rid AND name = 'Грчка салата'        LIMIT 1;
  SELECT id INTO mi_steak         FROM menu_items WHERE restaurant_id = rid AND name = 'Телешки стек 250g'   LIMIT 1;
  SELECT id INTO mi_chicken       FROM menu_items WHERE restaurant_id = rid AND name = 'Пилешки гради'       LIMIT 1;
  SELECT id INTO mi_pasta         FROM menu_items WHERE restaurant_id = rid AND name = 'Паста Карбонара'     LIMIT 1;
  SELECT id INTO mi_ribs          FROM menu_items WHERE restaurant_id = rid AND name = 'Свинско ребра'       LIMIT 1;
  SELECT id INTO mi_risotto       FROM menu_items WHERE restaurant_id = rid AND name = 'Ризото со печурки'   LIMIT 1;
  SELECT id INTO mi_margherita    FROM menu_items WHERE restaurant_id = rid AND name = 'Маргарита'           LIMIT 1;
  SELECT id INTO mi_pepperoni     FROM menu_items WHERE restaurant_id = rid AND name = 'Пеперони'            LIMIT 1;
  SELECT id INTO mi_quattro       FROM menu_items WHERE restaurant_id = rid AND name = 'Четири сирења'       LIMIT 1;
  SELECT id INTO mi_burger        FROM menu_items WHERE restaurant_id = rid AND name = 'Класичен бургер'     LIMIT 1;
  SELECT id INTO mi_chicken_burger FROM menu_items WHERE restaurant_id = rid AND name = 'Чикен бургер'      LIMIT 1;
  SELECT id INTO mi_smash         FROM menu_items WHERE restaurant_id = rid AND name = 'Дабл смаш бургер'   LIMIT 1;
  SELECT id INTO mi_tiramisu      FROM menu_items WHERE restaurant_id = rid AND name = 'Тирамису'            LIMIT 1;
  SELECT id INTO mi_pancakes      FROM menu_items WHERE restaurant_id = rid AND name = 'Палачинки со нутела' LIMIT 1;

  IF mi_cola IS NULL THEN
    RAISE EXCEPTION 'Menu items missing — run 01_demo_restaurant.sql first.';
  END IF;

  -- Generate paid orders: last 30 days
  -- Weekdays: 4-5 orders/day, Weekends: 7-9 orders/day
  FOR day_offset IN REVERSE 29..0 LOOP

    IF EXTRACT(dow FROM (CURRENT_DATE - day_offset)) IN (0, 6) THEN
      num_orders := 7 + (day_offset % 3);
    ELSE
      num_orders := 4 + (day_offset % 2);
    END IF;

    FOR i IN 1..num_orders LOOP
      IF i <= num_orders / 2 THEN
        order_time := (CURRENT_DATE - day_offset)::TIMESTAMP
                      + make_interval(hours => 12 + (i % 3), mins => (i * 13) % 60);
      ELSE
        order_time := (CURRENT_DATE - day_offset)::TIMESTAMP
                      + make_interval(hours => 18 + (i % 4), mins => (i * 17) % 60);
      END IF;

      INSERT INTO orders (
        restaurant_id, user_id, shift_id, order_type, status,
        guest_count, subtotal, total_amount, created_at, closed_at
      ) VALUES (
        rid, uid, shift_id, 'dine_in', 'paid',
        1 + (i % 4), 0, 0,
        order_time,
        order_time + make_interval(mins => 25 + (i * 7) % 35)
      ) RETURNING id INTO ord_id;

      v_subtotal := 0;

      -- Drinks (always)
      CASE (i % 5)
        WHEN 0 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_beer, 'Пиво 0.5l', 1 + (i % 2), 150, 'served');
          v_subtotal := v_subtotal + 150 * (1 + (i % 2));
        WHEN 1 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_cola, 'Кока Кола 0.33l', 2, 120, 'served');
          v_subtotal := v_subtotal + 240;
        WHEN 2 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_wine, 'Вино (чаша)', 1 + (i % 3), 200, 'served');
          v_subtotal := v_subtotal + 200 * (1 + (i % 3));
        WHEN 3 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_water, 'Вода 0.5l', 2, 80, 'served');
          v_subtotal := v_subtotal + 160;
        ELSE
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_juice, 'Сок од портокал', 1, 110, 'served');
          v_subtotal := v_subtotal + 110;
      END CASE;

      -- Main dish (always)
      CASE (i % 9)
        WHEN 0 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_margherita, 'Маргарита', 1, 350, 'served');
          v_subtotal := v_subtotal + 350;
        WHEN 1 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_burger, 'Класичен бургер', 1 + (i % 2), 380, 'served');
          v_subtotal := v_subtotal + 380 * (1 + (i % 2));
        WHEN 2 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_steak, 'Телешки стек 250g', 1, 650, 'served');
          v_subtotal := v_subtotal + 650;
        WHEN 3 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_chicken, 'Пилешки гради', 1, 480, 'served');
          v_subtotal := v_subtotal + 480;
        WHEN 4 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_pasta, 'Паста Карбонара', 1, 420, 'served');
          v_subtotal := v_subtotal + 420;
        WHEN 5 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_pepperoni, 'Пеперони', 1, 420, 'served');
          v_subtotal := v_subtotal + 420;
        WHEN 6 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_smash, 'Дабл смаш бургер', 1, 480, 'served');
          v_subtotal := v_subtotal + 480;
        WHEN 7 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_ribs, 'Свинско ребра', 1, 550, 'served');
          v_subtotal := v_subtotal + 550;
        ELSE
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_risotto, 'Ризото со печурки', 1, 450, 'served');
          v_subtotal := v_subtotal + 450;
      END CASE;

      -- Appetizer (every 3rd order)
      IF i % 3 = 0 THEN
        IF i % 6 = 0 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_soup, 'Пилешка чорба', 1, 200, 'served');
          v_subtotal := v_subtotal + 200;
        ELSE
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_salad, 'Грчка салата', 1, 250, 'served');
          v_subtotal := v_subtotal + 250;
        END IF;
      END IF;

      -- Dessert (every 4th order)
      IF i % 4 = 0 THEN
        IF i % 8 = 0 THEN
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_pancakes, 'Палачинки со нутела', 1, 180, 'served');
          v_subtotal := v_subtotal + 180;
        ELSE
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
            VALUES (ord_id, mi_tiramisu, 'Тирамису', 1, 250, 'served');
          v_subtotal := v_subtotal + 250;
        END IF;
      END IF;

      -- Coffee (every 5th order)
      IF i % 5 = 0 THEN
        INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, status)
          VALUES (ord_id, mi_coffee, 'Кафе еспресо', 1, 100, 'served');
        v_subtotal := v_subtotal + 100;
      END IF;

      UPDATE orders SET subtotal = v_subtotal, total_amount = v_subtotal WHERE id = ord_id;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed 02 complete — analytics orders inserted.';
END $$;
