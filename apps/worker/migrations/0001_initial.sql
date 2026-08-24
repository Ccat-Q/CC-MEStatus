CREATE TABLE IF NOT EXISTS device_policies (
  name TEXT PRIMARY KEY,
  favorite INTEGER NOT NULL DEFAULT 0,
  favorite_order INTEGER NOT NULL DEFAULT 0,
  writable INTEGER NOT NULL DEFAULT 0,
  direction TEXT,
  item_limit INTEGER,
  fluid_limit INTEGER,
  gas_limit INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  subject TEXT,
  amount INTEGER,
  target TEXT,
  success INTEGER NOT NULL,
  error TEXT,
  actor TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx ON audit_log(timestamp DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES
  ('item_limit', '64', unixepoch() * 1000),
  ('fluid_limit', '1000', unixepoch() * 1000),
  ('gas_limit', '1000', unixepoch() * 1000);

