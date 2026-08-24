CREATE TABLE IF NOT EXISTS quick_service_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quick_service_groups_status_sort (status, sort_order, id),
  CONSTRAINT chk_quick_service_groups_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quick_service_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(800) NULL,
  url VARCHAR(1000) NOT NULL,
  open_mode VARCHAR(20) NOT NULL DEFAULT 'new_tab',
  icon VARCHAR(50) NULL,
  color VARCHAR(30) NOT NULL DEFAULT 'blue',
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quick_service_cards_group_status_sort (group_id, status, sort_order, id),
  CONSTRAINT fk_quick_service_cards_group
    FOREIGN KEY (group_id) REFERENCES quick_service_groups (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_quick_service_cards_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_quick_service_cards_open_mode CHECK (open_mode IN ('current_tab', 'new_tab'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
