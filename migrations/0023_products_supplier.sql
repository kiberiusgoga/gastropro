-- Add supplier_id to products for supplier consumption tracking
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id)
  WHERE supplier_id IS NOT NULL;
