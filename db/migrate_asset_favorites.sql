CREATE TABLE IF NOT EXISTS asset_favorites (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NULL,
  user_workcode VARCHAR(100) NULL,
  asset_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asset_favorites_user_asset (user_id, asset_id),
  UNIQUE KEY uk_asset_favorites_workcode_asset (user_workcode, asset_id),
  KEY idx_asset_favorites_user (user_id),
  KEY idx_asset_favorites_workcode (user_workcode),
  KEY idx_asset_favorites_asset (asset_id)
);
