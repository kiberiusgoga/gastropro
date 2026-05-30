-- HR Work Hours: work_entries + hr_settings
-- Feature 3: employee time tracking with overtime detection

CREATE TABLE IF NOT EXISTS work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  clock_in  TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,

  role          TEXT,
  break_minutes INTEGER DEFAULT 0 CHECK (break_minutes >= 0),
  hours_worked  NUMERIC(5,2),

  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_entries_one_open_per_user
  ON work_entries(user_id) WHERE clock_out IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_entries_restaurant_user
  ON work_entries(restaurant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_work_entries_clock_in
  ON work_entries(restaurant_id, clock_in);

CREATE TABLE IF NOT EXISTS hr_settings (
  restaurant_id             UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  weekly_overtime_threshold NUMERIC(4,2) DEFAULT 40,
  daily_overtime_threshold  NUMERIC(4,2) DEFAULT 8,
  week_starts_on            INTEGER      DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
  default_break_minutes     INTEGER      DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
