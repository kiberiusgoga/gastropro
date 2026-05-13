BEGIN;

-- Track image metadata separately from the URL.
-- The url column already exists on menu_items (it points to Lorem Picsum
-- for seeded data). We extend with metadata that helps with optimization
-- and cleanup.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_public_id TEXT,
  ADD COLUMN IF NOT EXISTS image_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS image_width INTEGER,
  ADD COLUMN IF NOT EXISTS image_height INTEGER;

COMMENT ON COLUMN menu_items.image_url IS
  'Public URL of the menu item image. Set by upload flow. NULL means
   no custom image — frontend may fall back to placeholder.';

COMMENT ON COLUMN menu_items.image_public_id IS
  'Cloudinary public_id (when applicable). Used for deletion when
   image is replaced. NULL for local-storage uploads or external URLs.';

-- Migrate any existing url values to image_url so we have one canonical
-- column going forward. If menu_items.url does not exist, this is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'url'
  ) THEN
    UPDATE menu_items SET image_url = url WHERE url IS NOT NULL AND image_url IS NULL;
  END IF;
END $$;

-- Audit log entry for image operations.
ALTER TABLE auth_audit_log DROP CONSTRAINT IF EXISTS auth_audit_log_action_check;
ALTER TABLE auth_audit_log ADD CONSTRAINT auth_audit_log_action_check
  CHECK (action IN (
    'login_success', 'login_failure', 'logout', 'password_changed',
    'password_reset_requested', 'password_reset_completed',
    'role_changed', 'account_created', 'account_deactivated',
    'refresh_rotated', 'refresh_revoked', 'suspected_token_theft',
    'sse_ticket_issued', 'sse_connection_opened', 'sse_forced_logout',
    'shift_closed', 'refresh_chain_depth_exceeded',
    'menu_item_image_uploaded', 'menu_item_image_deleted'
  ));

COMMIT;
