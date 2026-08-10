
CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT PRIMARY KEY,
  visitors INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  active_seconds_total INTEGER NOT NULL DEFAULT 0,
  active_sessions INTEGER NOT NULL DEFAULT 0,
  answers INTEGER NOT NULL DEFAULT 0,
  started INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  result_views INTEGER NOT NULL DEFAULT 0,
  note_clicks INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytics_daily_types (
  day TEXT NOT NULL,
  type TEXT NOT NULL CHECK (length(type) = 4),
  completed INTEGER NOT NULL DEFAULT 0,
  note_clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_types_day
ON analytics_daily_types(day);

