CREATE TABLE IF NOT EXISTS non_fiscal_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  company_id      UUID NOT NULL REFERENCES companies(id),
  order_id        UUID REFERENCES orders(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  subtotal        NUMERIC(12,2) NOT NULL,
  vat_rate        NUMERIC(5,2) NOT NULL DEFAULT 18,
  vat_amount      NUMERIC(12,2) NOT NULL,
  total_amount    NUMERIC(12,2) NOT NULL,
  notes           TEXT,
  paid_at         TIMESTAMPTZ,
  paid_amount     NUMERIC(12,2),
  paid_method     TEXT,
  paid_reference  TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS non_fiscal_invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES non_fiscal_invoices(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  name          TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL,
  vat_rate      NUMERIC(5,2) NOT NULL DEFAULT 18,
  total         NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS nfi_restaurant_status_idx
  ON non_fiscal_invoices(restaurant_id, status);
CREATE INDEX IF NOT EXISTS nfi_company_idx
  ON non_fiscal_invoices(company_id);
CREATE INDEX IF NOT EXISTS nfi_order_idx
  ON non_fiscal_invoices(order_id);
