ALTER TABLE assets
  ADD COLUMN owner_user_id INT NULL AFTER description,
  ADD KEY idx_assets_owner_user_id (owner_user_id);

CREATE TABLE IF NOT EXISTS asset_departments (
  asset_id BIGINT UNSIGNED NOT NULL,
  department_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, department_id),
  KEY idx_asset_departments_department (department_id, asset_id),
  CONSTRAINT fk_asset_departments_asset
    FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE asset_visit_logs
  ADD COLUMN department_id VARCHAR(128) NULL AFTER user_id,
  ADD KEY idx_asset_visit_logs_department_id_time (department_id, visited_at);
