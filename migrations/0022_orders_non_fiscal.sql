ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'fiscal'
    CHECK (payment_type IN ('fiscal', 'non_fiscal')),
  ADD COLUMN IF NOT EXISTS non_fiscal_invoice_id UUID
    REFERENCES non_fiscal_invoices(id);
