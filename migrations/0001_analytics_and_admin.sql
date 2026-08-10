PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  entry_path TEXT NOT NULL DEFAULT '/',
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  answers_count INTEGER NOT NULL DEFAULT 0 CHECK (answers_count BETWEEN 0 AND 30),
  answer_started_at TEXT,
  completed_at TEXT,
  result_viewed_at TEXT,
  result_type TEXT CHECK (result_type IS NULL OR length(result_type) = 4),
  note_clicked_at TEXT,
  note_type TEXT CHECK (note_type IS NULL OR length(note_type) = 4)
);

CREATE INDEX IF NOT EXISTS idx_analytics_started_at ON analytics_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_completed ON analytics_sessions(completed_at);
CREATE INDEX IF NOT EXISTS idx_analytics_note_clicked ON analytics_sessions(note_clicked_at);
CREATE INDEX IF NOT EXISTS idx_analytics_result_type ON analytics_sessions(result_type);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS limit_admin_users_to_two
BEFORE INSERT ON admin_users
WHEN (SELECT COUNT(*) FROM admin_users) >= 2
BEGIN
  SELECT RAISE(ABORT, 'at most two administrators are allowed');
END;

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);
