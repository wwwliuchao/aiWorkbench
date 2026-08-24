CREATE DATABASE IF NOT EXISTS asset_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE asset_portal;

CREATE TABLE IF NOT EXISTS directories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_directories_status_sort (status, sort_order, id),
  KEY idx_directories_parent_status_sort (parent_id, status, sort_order, id),
  CONSTRAINT fk_directories_parent
    FOREIGN KEY (parent_id) REFERENCES directories (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_directories_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  directory_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(800) NULL,
  owner_user_id INT NULL,
  owner_workcode VARCHAR(100) NULL,
  owner_name VARCHAR(80) NULL,
  department_name VARCHAR(120) NULL,
  url VARCHAR(1000) NOT NULL,
  open_mode VARCHAR(20) NOT NULL DEFAULT 'new_tab',
  tags JSON NOT NULL,
  click_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assets_directory_status_sort (directory_id, status, sort_order, id),
  KEY idx_assets_type_status (type, status),
  KEY idx_assets_owner_user_id (owner_user_id),
  KEY idx_assets_owner_workcode (owner_workcode),
  KEY idx_assets_click_count (click_count),
  FULLTEXT KEY ft_assets_search (name, description, owner_name, department_name),
  CONSTRAINT fk_assets_directory
    FOREIGN KEY (directory_id) REFERENCES directories (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_assets_type
    FOREIGN KEY (type) REFERENCES asset_types (code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_assets_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_assets_open_mode CHECK (open_mode IN ('current_tab', 'new_tab'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS asset_visit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NOT NULL,
  user_id INT NULL,
  user_workcode VARCHAR(100) NULL,
  department_id VARCHAR(128) NULL,
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
  KEY idx_asset_visit_logs_user_workcode_time (user_workcode, visited_at),
  KEY idx_asset_visit_logs_department_id_time (department_id, visited_at),
  CONSTRAINT fk_asset_visit_logs_asset
    FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

INSERT INTO directories (id, parent_id, name, description, sort_order, status)
VALUES
  (1, NULL, '销售运营', '销售相关多维表和自动化工作流', 10, 'active'),
  (2, NULL, '供应链', '采购、库存、履约相关入口', 20, 'active'),
  (3, NULL, '测试停用目录', '该目录不会在页面展示', 99, 'inactive'),
  (101, 1, '销售多维表', '销售团队常用 Base 入口', 10, 'active'),
  (102, 1, '销售工作流', '销售团队常用 Dify 工作流', 20, 'active'),
  (201, 2, '供应链多维表', '供应链常用 Base 入口', 10, 'active'),
  (202, 2, '供应链工作流', '供应链常用 Dify 工作流', 20, 'active')
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  name = VALUES(name),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  status = VALUES(status);

INSERT INTO assets (
  id,
  directory_id,
  type,
  name,
  description,
  owner_name,
  department_name,
  url,
  tags,
  sort_order,
  status
)
VALUES
  (
    1,
    101,
    'feishu_base',
    '客户跟进多维表',
    '销售团队维护客户跟进状态和重点机会。',
    '销售运营',
    'Sales Operations',
    'https://example.feishu.cn/base/sample-sales',
    JSON_ARRAY('销售', '客户', '跟进'),
    10,
    'active'
  ),
  (
    2,
    102,
    'dify_workflow',
    '销售日报生成工作流',
    '根据销售记录生成每日摘要，输出给业务群。',
    '销售运营',
    'Sales Operations',
    'https://example.com/dify/workflow/sales-daily',
    JSON_ARRAY('Dify', '日报', '自动化'),
    20,
    'active'
  ),
  (
    3,
    201,
    'feishu_base',
    '库存监控多维表',
    '供应链团队查看重点 SKU 的库存和预警状态。',
    '供应链',
    'Supply Chain',
    'https://example.feishu.cn/base/sample-inventory',
    JSON_ARRAY('供应链', '库存'),
    10,
    'active'
  ),
  (
    4,
    202,
    'dify_workflow',
    '采购异常分析工作流',
    '汇总采购异常描述，生成处理建议。',
    '采购组',
    'Supply Chain',
    'https://example.com/dify/workflow/procurement-risk',
    JSON_ARRAY('采购', '异常', '分析'),
    20,
    'active'
  ),
  (
    5,
    101,
    'feishu_base',
    '停用示例资产',
    '该资产不会在页面展示。',
    '测试',
    'Test',
    'https://example.com/inactive',
    JSON_ARRAY('停用'),
    99,
    'inactive'
  )
ON DUPLICATE KEY UPDATE
  directory_id = VALUES(directory_id),
  type = VALUES(type),
  name = VALUES(name),
  description = VALUES(description),
  owner_name = VALUES(owner_name),
  department_name = VALUES(department_name),
  url = VALUES(url),
  tags = VALUES(tags),
  sort_order = VALUES(sort_order),
  status = VALUES(status);
