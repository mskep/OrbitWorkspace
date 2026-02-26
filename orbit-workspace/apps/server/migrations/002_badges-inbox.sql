-- ============================================================
-- Orbit Sync Server — Badges & Inbox (server-authoritative)
-- Migration 002
-- ============================================================

-- ============================================================
-- BADGES (system-defined, same as client seed)
-- ============================================================
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default badges
INSERT INTO badges (id, name, display_name, description, icon, color) VALUES
  ('badge-1', 'beta-tester',  'Beta Tester',   'Early adopter of Orbit',          '🧪', '#667eea'),
  ('badge-2', 'orbit-team',   'Orbit Team',    'Member of the Orbit team',        '⭐', '#f59e0b'),
  ('badge-3', 'contributor',  'Contributor',   'Contributed to the Orbit project', '🔧', '#10b981'),
  ('badge-4', 'partner',      'Partner',       'Official Orbit partner',          '🤝', '#8b5cf6'),
  ('badge-5', 'trusted-user', 'Trusted User',  'Verified trusted user',           '✓',  '#06b6d4');

-- ============================================================
-- USER BADGES (server-authoritative)
-- ============================================================
CREATE TABLE user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- ============================================================
-- INBOX MESSAGES (server-authoritative, plaintext on server)
-- Clients cache locally with E2EE at rest via client-side encryption.
-- ============================================================
CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'badge-assigned',
    'badge-revoked',
    'role-changed',
    'system-notification',
    'admin-broadcast',
    'admin-maintenance',
    'admin-update',
    'admin-security'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inbox_user ON inbox_messages(user_id);
CREATE INDEX idx_inbox_unread ON inbox_messages(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_inbox_updated ON inbox_messages(user_id, updated_at);
