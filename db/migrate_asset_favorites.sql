CREATE TABLE IF NOT EXISTS asset_favorites (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  asset_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asset_favorites_user_asset (user_id, asset_id),
  KEY idx_asset_favorites_user (user_id),
  KEY idx_asset_favorites_asset (asset_id)
);
