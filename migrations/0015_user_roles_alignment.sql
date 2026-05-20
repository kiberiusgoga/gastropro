BEGIN;

-- Align users.role CHECK constraint with the application role enum.
--
-- Original constraint (0001_base_schema.sql) allowed only:
--   'Admin', 'Manager', 'Warehouse Worker'
--
-- Application has since added 4 roles in Zod schema, frontend dropdown,
-- and TypeScript types — but no migration ever updated the DB constraint.
-- Result: any attempt to create Waiter/Chef/Cashier/Driver users fails
-- with constraint violation.
--
-- This migration widens the constraint to match the application's
-- canonical UserRole list (excluding the vestigial 'SuperAdmin' that
-- exists only as a TS type annotation, never assigned).

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  -- Locate the existing CHECK by anchoring on 'Warehouse Worker'
  -- (present in the original constraint since 0001_base_schema)
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%Warehouse Worker%';

  IF v_conname IS NULL THEN
    RAISE EXCEPTION
      'Migration 0015: users role CHECK not found via Warehouse Worker anchor. '
      'Inspect pg_constraint and update this migration before retrying.';
  END IF;

  EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', v_conname);
END $$;

-- ADD CONSTRAINT in same transaction. If this fails, the DROP rolls back.
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'Admin',
    'Manager',
    'Warehouse Worker',
    'Waiter',
    'Chef',
    'Cashier',
    'Driver'
  ));

COMMIT;
