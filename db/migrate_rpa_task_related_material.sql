ALTER TABLE rpa_task
  ADD COLUMN related_material_url VARCHAR(1000) NULL AFTER requirement_doc_url;
