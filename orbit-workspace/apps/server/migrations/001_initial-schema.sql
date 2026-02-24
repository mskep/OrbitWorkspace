-- ============================================================
-- Orbit Sync Server — Initial Schema
-- Migration 001
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER'
    CHECK (role IN ('ADMIN', 'DEV', 'PREMIUM', 'USER')),
  role_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER CRYPTO (E2EE blobs — server CANNOT read these)
-- ============================================================
CREATE TABLE user_crypto (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  encrypted_master_key TEXT NOT NULL,
  recovery_blob TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  kdf_params JSONB NOT NULL DEFAULT
    '{"algorithm":"argon2id","memoryCost":65536,"timeCost":3,"parallelism":4,"hashLength":32}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEVICES (max 5 per user, enforced at application level)
-- ============================================================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL UNIQUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_devices_user ON devices(user_id);

-- ============================================================
-- SESSIONS (refresh tokens with rotation + reuse detection)
-- family_id groups a chain of rotated tokens.
-- If a revoked token is reused, the entire family is invalidated.
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_family ON sessions(family_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- USER SYNC STATE (monotonic server_clock per user)
-- Incremented on every sync write (insert or update).
-- Pull uses this clock: GET /sync/pull?since=<server_clock>
-- ============================================================
CREATE TABLE user_sync_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_clock BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- SYNC BLOBS (E2EE encrypted data — opaque to server)
-- ============================================================
CREATE TABLE sync_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  server_clock BIGINT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  tag TEXT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);
CREATE INDEX idx_sync_blobs_user_clock ON sync_blobs(user_id, server_clock);
CREATE INDEX idx_sync_blobs_user_type ON sync_blobs(user_id, entity_type);

-- ============================================================
-- SYNC OPS (idempotency — dedicated table per Codex recommendation)
-- Tracks every operation by op_id to prevent duplicates on retry.
-- Separate from sync_blobs to preserve operation history per entity.
-- ============================================================
CREATE TABLE sync_ops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  op_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  server_clock BIGINT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, op_id)
);
CREATE INDEX idx_sync_ops_entity ON sync_ops(user_id, entity_type, entity_id);

-- ============================================================
-- SYNC CURSORS (tracks where each device is in the sync stream)
-- ============================================================
CREATE TABLE sync_cursors (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  last_synced_clock BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, device_id)
);
