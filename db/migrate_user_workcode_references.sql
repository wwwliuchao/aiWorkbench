ALTER TABLE assets
  ADD COLUMN owner_workcode VARCHAR(100) NULL AFTER owner_user_id,
  ADD KEY idx_assets_owner_workcode (owner_workcode);

UPDATE assets a
INNER JOIN eip.sys_user u ON u.user_id = a.owner_user_id
SET a.owner_workcode = TRIM(u.workcode)
WHERE u.workcode IS NOT NULL AND TRIM(u.workcode) <> '';

ALTER TABLE asset_visit_logs
  ADD COLUMN user_workcode VARCHAR(100) NULL AFTER user_id,
  ADD KEY idx_asset_visit_logs_user_workcode_time (user_workcode, visited_at);

UPDATE asset_visit_logs vl
INNER JOIN eip.sys_user u ON u.user_id = vl.user_id
SET vl.user_workcode = TRIM(u.workcode)
WHERE u.workcode IS NOT NULL AND TRIM(u.workcode) <> '';

ALTER TABLE asset_favorites
  MODIFY COLUMN user_id BIGINT NULL,
  ADD COLUMN user_workcode VARCHAR(100) NULL AFTER user_id,
  ADD UNIQUE KEY uk_asset_favorites_workcode_asset (user_workcode, asset_id),
  ADD KEY idx_asset_favorites_workcode (user_workcode);

UPDATE asset_favorites af
INNER JOIN eip.sys_user u ON u.user_id = af.user_id
SET af.user_workcode = TRIM(u.workcode)
WHERE u.workcode IS NOT NULL AND TRIM(u.workcode) <> '';
