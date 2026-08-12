 CREATE TABLE IF NOT EXISTS active_presence (
  session_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_active_presence_last_seen ON active_presence(last_seen);
