ALTER TABLE assets
  ADD COLUMN department_name VARCHAR(120) NULL AFTER owner_name;

ALTER TABLE assets
  DROP INDEX ft_assets_search,
  ADD FULLTEXT KEY ft_assets_search (name, description, owner_name, department_name);
