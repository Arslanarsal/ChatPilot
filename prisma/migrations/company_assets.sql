-- Create company_assets table for storing uploaded files (images, PDFs, docs) with descriptions
CREATE TABLE IF NOT EXISTS company_assets (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  CONSTRAINT fk_company_assets_company FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_assets_company_id ON company_assets(company_id);
