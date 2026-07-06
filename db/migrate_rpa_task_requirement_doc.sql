ALTER TABLE rpa_task
  ADD COLUMN requirement_doc_url VARCHAR(1000) NULL AFTER task_uuid;
