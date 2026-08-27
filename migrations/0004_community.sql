PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('relationship', 'continuity', 'practice', 'creation')),
  title TEXT NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS community_threads_status_created
  ON community_threads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS community_threads_category_status_created
  ON community_threads (category, status, created_at DESC);

CREATE INDEX IF NOT EXISTS community_threads_ip_created
  ON community_threads (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS community_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  ip_hash TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES community_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS community_replies_thread_status_created
  ON community_replies (thread_id, status, created_at ASC);

CREATE INDEX IF NOT EXISTS community_replies_status_created
  ON community_replies (status, created_at ASC);

CREATE INDEX IF NOT EXISTS community_replies_ip_created
  ON community_replies (ip_hash, created_at DESC);
