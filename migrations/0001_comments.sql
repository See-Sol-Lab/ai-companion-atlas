CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT NOT NULL,
  nickname TEXT,
  content TEXT NOT NULL,
  platform TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'partial', 'failed')),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_project_status_created
  ON comments (project_slug, status, created_at DESC);

CREATE INDEX IF NOT EXISTS comments_status_created
  ON comments (status, created_at ASC);

CREATE INDEX IF NOT EXISTS comments_ip_created
  ON comments (ip_hash, created_at DESC);
