ALTER TABLE assets
  ADD COLUMN open_mode VARCHAR(20) NOT NULL DEFAULT 'new_tab' AFTER url,
  ADD CONSTRAINT chk_assets_open_mode CHECK (open_mode IN ('current_tab', 'new_tab'));
