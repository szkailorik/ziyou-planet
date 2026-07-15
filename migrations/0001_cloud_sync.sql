PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  sync_code_hash TEXT NOT NULL UNIQUE,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  settings_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS devices_family_id_idx ON devices(family_id);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  character_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  result TEXT NOT NULL,
  confidence TEXT,
  latency_ms INTEGER NOT NULL,
  hint_used INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (family_id, id),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS attempts_family_time_idx ON attempts(family_id, occurred_at);
CREATE INDEX IF NOT EXISTS attempts_family_child_idx ON attempts(family_id, child_id);
