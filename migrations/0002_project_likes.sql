CREATE TABLE IF NOT EXISTS project_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  UNIQUE (project_slug, ip_hash)
);

CREATE INDEX IF NOT EXISTS project_likes_created
  ON project_likes (created_at DESC);
