CREATE TABLE IF NOT EXISTS companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  tin             TEXT NOT NULL,
  embs            TEXT,
  address         TEXT,
  city            TEXT,
  postal_code     TEXT,
  contact_person  TEXT,
  email           TEXT,
  phone           TEXT,
  bank_account    TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 15,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS companies_restaurant_id_idx
  ON companies(restaurant_id) WHERE deleted_at IS NULL;
