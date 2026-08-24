CREATE TABLE IF NOT EXISTS project_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  project_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_submissions_status_created
  ON project_submissions (status, created_at ASC);

CREATE INDEX IF NOT EXISTS project_submissions_ip_created
  ON project_submissions (ip_hash, created_at DESC);
