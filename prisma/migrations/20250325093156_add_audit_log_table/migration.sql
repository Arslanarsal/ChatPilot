-- This is an empty migration.
 CREATE TABLE IF NOT EXISTS audit_table (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      src_table TEXT NOT NULL,
      col_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      record_id INTEGER,
      "user" TEXT NOT NULL DEFAULT current_user,
      action TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_table_changed_at ON audit_table (changed_at);
    CREATE INDEX IF NOT EXISTS idx_audit_table_src_table ON audit_table (src_table);
    CREATE INDEX IF NOT EXISTS idx_audit_table_col_name ON audit_table (col_name);

