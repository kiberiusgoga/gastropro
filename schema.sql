-- PostgreSQL Schema for Storehouse Management System
-- Production Ready Migration Script

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('Admin', 'Manager', 'Warehouse Worker')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  unit TEXT CHECK (unit IN ('kg', 'l', 'pcs', 'box')),
  purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  current_stock NUMERIC(15, 3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(15, 3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  date DATE NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('draft', 'completed')),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC(15, 3) NOT NULL,
  price NUMERIC(15, 2) NOT NULL,
  total NUMERIC(15, 2) NOT NULL
);

-- Transactions (Audit Trail)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  type TEXT CHECK (type IN ('receipt', 'input', 'output', 'inventory_check', 'storno')),
  quantity NUMERIC(15, 3) NOT NULL,
  previous_stock NUMERIC(15, 3) NOT NULL,
  new_stock NUMERIC(15, 3) NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES users(id),
  reference_id UUID,
  note TEXT
);

-- Bundles
CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bundle Items
CREATE TABLE IF NOT EXISTS bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID REFERENCES bundles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC(15, 3) NOT NULL
);

-- Inventory Checks
CREATE TABLE IF NOT EXISTS inventory_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK (status IN ('draft', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Check Items
CREATE TABLE IF NOT EXISTS inventory_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID REFERENCES inventory_checks(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  system_qty NUMERIC(15, 3) NOT NULL,
  real_qty NUMERIC(15, 3) NOT NULL,
  diff NUMERIC(15, 3) NOT NULL
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON bundle_items(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_check_items_check_id ON inventory_check_items(check_id);
CREATE INDEX IF NOT EXISTS idx_inventory_check_items_product_id ON inventory_check_items(product_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
