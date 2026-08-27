PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  used_at TEXT,
  used_by INTEGER UNIQUE
);

CREATE TABLE IF NOT EXISTS community_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  invite_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  FOREIGN KEY (invite_id) REFERENCES community_invites(id)
);

CREATE TABLE IF NOT EXISTS community_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS community_sessions_user_expires
  ON community_sessions (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS community_sessions_expires
  ON community_sessions (expires_at ASC);

ALTER TABLE community_threads ADD COLUMN user_id INTEGER REFERENCES community_users(id);
ALTER TABLE community_replies ADD COLUMN user_id INTEGER REFERENCES community_users(id);

CREATE INDEX IF NOT EXISTS community_threads_user_created
  ON community_threads (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS community_replies_user_created
  ON community_replies (user_id, created_at DESC);
