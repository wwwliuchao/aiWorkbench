USE asset_portal;

CREATE TABLE IF NOT EXISTS asset_types (
  code VARCHAR(50) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300) NULL,
  color VARCHAR(30) NOT NULL DEFAULT 'green',
  icon VARCHAR(50) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (code),
  KEY idx_asset_types_status_sort (status, sort_order, code),
  CONSTRAINT chk_asset_types_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO asset_types (code, name, description, color, icon, sort_order, status)
VALUES
  ('feishu_base', '飞书多维表', '飞书 Base / 多维表格入口', 'green', '▦', 10, 'active'),
  ('dify_workflow', 'Dify 工作流', 'Dify Workflow 应用入口', 'blue', '◇', 20, 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  color = VALUES(color),
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  status = VALUES(status);

ALTER TABLE assets
  MODIFY COLUMN type VARCHAR(50) NOT NULL;

ALTER TABLE assets
  ADD CONSTRAINT fk_assets_type
    FOREIGN KEY (type) REFERENCES asset_types (code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
