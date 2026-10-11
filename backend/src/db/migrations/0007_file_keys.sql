ALTER TABLE prescription_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';

ALTER TABLE compounding_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';
