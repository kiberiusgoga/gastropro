-- Per-restaurant email settings
CREATE TABLE IF NOT EXISTS email_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  smtp_host            TEXT,
  smtp_port            INTEGER DEFAULT 587,
  smtp_user            TEXT,
  smtp_pass            TEXT,
  smtp_from            TEXT,
  auto_send_on_z_close BOOLEAN NOT NULL DEFAULT FALSE,
  subject_template     TEXT NOT NULL DEFAULT 'Дневна потрошувачка — {date} — {restaurant_name}',
  body_template        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log of all supplier emails (sent / failed / manual / draft)
CREATE TABLE IF NOT EXISTS supplier_email_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id    UUID REFERENCES suppliers(id),
  supplier_name  TEXT NOT NULL,
  supplier_email TEXT,
  shift_id       UUID REFERENCES shifts(id),
  subject        TEXT,
  body           TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('sent', 'failed', 'manual', 'draft')),
  error_message  TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_email_log_restaurant
  ON supplier_email_log(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_email_log_shift
  ON supplier_email_log(shift_id);
