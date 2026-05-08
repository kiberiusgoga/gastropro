-- Migration: 0004_soft_deletes
-- Adds soft-delete support for customers and suppliers.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_active
  ON customers(restaurant_id)
  WHERE deleted_at IS NULL;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_suppliers_active
  ON suppliers(restaurant_id)
  WHERE deleted_at IS NULL;
