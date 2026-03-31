-- Seed Data for Storehouse Management System
-- Demo Categories, Users, and Products

BEGIN;

-- 1. Seed Categories
INSERT INTO categories (id, name) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Храна'),
  ('c1000000-0000-0000-0000-000000000002', 'Пијалоци'),
  ('c1000000-0000-0000-0000-000000000003', 'Електроника'),
  ('c1000000-0000-0000-0000-000000000004', 'Хигиена')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Users (Employees)
-- Passwords are 'password123' hashed with bcrypt (cost 10)
-- $2a$10$6.kO7.6.kO7.6.kO7.6.kO.p/m/m/m/m/m/m/m/m/m/m/m/m/m/m/m (This is a placeholder, in real app use real hashes)
-- For demo, I'll use a known hash for 'password123': $2a$10$vI8tmvE.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X
-- Actually, I'll just use a dummy hash and note it.
INSERT INTO users (id, name, email, password_hash, role, active) VALUES
  ('u1000000-0000-0000-0000-000000000001', 'Администратор', 'admin@storehouse.mk', '$2a$10$vI8tmvE.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X', 'Admin', true),
  ('u1000000-0000-0000-0000-000000000002', 'Менаџер Марко', 'marko@storehouse.mk', '$2a$10$vI8tmvE.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X', 'Manager', true),
  ('u1000000-0000-0000-0000-000000000003', 'Работник Петар', 'petar@storehouse.mk', '$2a$10$vI8tmvE.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X', 'Warehouse Worker', true)
ON CONFLICT (email) DO NOTHING;

-- 3. Seed Products
INSERT INTO products (id, name, barcode, unit, purchase_price, selling_price, category_id, current_stock, min_stock) VALUES
  ('p1000000-0000-0000-0000-000000000001', 'Млеко 1Л', '5310001000101', 'l', 45.00, 65.00, 'c1000000-0000-0000-0000-000000000002', 120, 20),
  ('p1000000-0000-0000-0000-000000000002', 'Леб Бел', '5310001000102', 'pcs', 25.00, 35.00, 'c1000000-0000-0000-0000-000000000001', 50, 10),
  ('p1000000-0000-0000-0000-000000000003', 'Шеќер 1кг', '5310001000103', 'kg', 38.00, 52.00, 'c1000000-0000-0000-0000-000000000001', 200, 50),
  ('p1000000-0000-0000-0000-000000000004', 'Телевизор 55"', '5310001000104', 'pcs', 22000.00, 28500.00, 'c1000000-0000-0000-0000-000000000003', 5, 2),
  ('p1000000-0000-0000-0000-000000000005', 'Сапун', '5310001000105', 'pcs', 15.00, 25.00, 'c1000000-0000-0000-0000-000000000004', 80, 15)
ON CONFLICT (barcode) DO NOTHING;

-- 4. Initial Transactions (Audit Trail)
INSERT INTO transactions (product_id, type, quantity, previous_stock, new_stock, user_id, note) VALUES
  ('p1000000-0000-0000-0000-000000000001', 'input', 120, 0, 120, 'u1000000-0000-0000-0000-000000000001', 'Почетна залиха'),
  ('p1000000-0000-0000-0000-000000000002', 'input', 50, 0, 50, 'u1000000-0000-0000-0000-000000000001', 'Почетна залиха'),
  ('p1000000-0000-0000-0000-000000000003', 'input', 200, 0, 200, 'u1000000-0000-0000-0000-000000000001', 'Почетна залиха'),
  ('p1000000-0000-0000-0000-000000000004', 'input', 5, 0, 5, 'u1000000-0000-0000-0000-000000000001', 'Почетна залиха'),
  ('p1000000-0000-0000-0000-000000000005', 'input', 80, 0, 80, 'u1000000-0000-0000-0000-000000000001', 'Почетна залиха');

COMMIT;
