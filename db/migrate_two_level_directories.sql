USE asset_portal;

ALTER TABLE directories
  ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_directories_parent_status_sort (parent_id, status, sort_order, id),
  ADD CONSTRAINT fk_directories_parent
    FOREIGN KEY (parent_id) REFERENCES directories (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

UPDATE directories
SET parent_id = NULL
WHERE id IN (1, 2, 3);

INSERT INTO directories (id, parent_id, name, description, sort_order, status)
VALUES
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

UPDATE assets SET directory_id = 101 WHERE id IN (1, 5);
UPDATE assets SET directory_id = 102 WHERE id = 2;
UPDATE assets SET directory_id = 201 WHERE id = 3;
UPDATE assets SET directory_id = 202 WHERE id = 4;
