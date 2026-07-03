USE asset_portal;

ALTER TABLE assets
  ADD COLUMN click_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER tags,
  ADD KEY idx_assets_click_count (click_count);
