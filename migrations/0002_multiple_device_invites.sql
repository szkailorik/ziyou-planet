PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS family_invites (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  max_uses INTEGER NOT NULL DEFAULT 8 CHECK (max_uses >= 1),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  revoked_at TEXT,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS family_invites_family_id_idx ON family_invites(family_id);
CREATE INDEX IF NOT EXISTS family_invites_active_idx ON family_invites(family_id, revoked_at, expires_at);

-- Preserve every existing family's current code as its first reusable invitation.
INSERT OR IGNORE INTO family_invites (id, family_id, code_hash, created_at, expires_at, max_uses, use_count, revoked_at)
SELECT 'legacy-' || id, id, sync_code_hash, created_at, NULL, 50, 0, NULL
FROM families;
