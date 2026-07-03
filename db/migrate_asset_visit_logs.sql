CREATE TABLE IF NOT EXISTS asset_visit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NOT NULL,
  user_id INT NULL,
  user_name VARCHAR(120) NULL,
  user_email VARCHAR(255) NULL,
  department_name VARCHAR(120) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_asset_visit_logs_asset_time (asset_id, visited_at),
  KEY idx_asset_visit_logs_time (visited_at),
  KEY idx_asset_visit_logs_department_time (department_name, visited_at),
  KEY idx_asset_visit_logs_user_time (user_id, visited_at),
  CONSTRAINT fk_asset_visit_logs_asset
    FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
