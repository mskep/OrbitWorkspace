-- ============================================
-- ORBIT Database Schema v0.x
-- SQLite + AES-256-GCM Encryption
-- ============================================

-- Encryption Format: v1:base64(12-byte-iv + ciphertext + 16-byte-tag)
-- Algorithm: AES-256-GCM with random IV per encryption


-- ============================================
-- USERS & AUTH
-- ============================================

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  CONSTRAINT chk_role CHECK (role IN ('USER', 'PREMIUM', 'DEV', 'ADMIN')),
  CONSTRAINT chk_status CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);


CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,              -- NOT NULL, default 30 days
  last_activity_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);


-- ============================================
-- USER SETTINGS (Encrypted JSON + Active Workspace)
-- ============================================

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  active_workspace_id TEXT,                 -- Current active workspace
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  notifications_enabled INTEGER DEFAULT 1,
  auto_launch_enabled INTEGER DEFAULT 0,
  settings_json_encrypted TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (active_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);


-- ============================================
-- WORKSPACES
-- ============================================

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);


-- ============================================
-- NOTES (Content encrypted, title plaintext)
-- ============================================

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_encrypted TEXT NOT NULL,
  tags TEXT,
  is_pinned INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_workspace_id ON notes(workspace_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_title ON notes(title);
CREATE INDEX idx_notes_pinned ON notes(is_pinned);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);


-- ============================================
-- LINKS (URL encrypted, title plaintext)
-- ============================================

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url_encrypted TEXT NOT NULL,
  description_encrypted TEXT,
  tags TEXT,
  favicon_url TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_links_workspace_id ON links(workspace_id);
CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_title ON links(title);
CREATE INDEX idx_links_favorite ON links(is_favorite);


-- ============================================
-- FILE REFERENCES (Path encrypted, name plaintext)
-- ============================================

CREATE TABLE file_references (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path_encrypted TEXT NOT NULL,
  type TEXT NOT NULL,
  description_encrypted TEXT,
  tags TEXT,
  is_pinned INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_file_type CHECK (type IN ('file', 'folder'))
);

CREATE INDEX idx_file_refs_workspace_id ON file_references(workspace_id);
CREATE INDEX idx_file_refs_user_id ON file_references(user_id);
CREATE INDEX idx_file_refs_type ON file_references(type);
CREATE INDEX idx_file_refs_name ON file_references(name);


-- ============================================
-- WORKSPACE TOOLS (Many-to-Many)
-- ============================================

CREATE TABLE workspace_tools (
  workspace_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  is_visible INTEGER DEFAULT 1,
  display_order INTEGER,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, tool_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspace_tools_workspace ON workspace_tools(workspace_id);


-- ============================================
-- BADGES
-- ============================================

CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  created_at INTEGER NOT NULL
);

-- Pre-populate badges
INSERT INTO badges (id, name, display_name, description, icon, color, created_at) VALUES
  ('badge-1', 'beta-tester', 'Beta Tester', 'Early adopter helping test new features', '🧪', '#667eea', strftime('%s', 'now')),
  ('badge-2', 'orbit-team', 'Orbit Team', 'Official Orbit team member', '⭐', '#f59e0b', strftime('%s', 'now')),
  ('badge-3', 'contributor', 'Contributor', 'Contributed to Orbit development', '🔧', '#10b981', strftime('%s', 'now')),
  ('badge-4', 'partner', 'Partner', 'Orbit partner organization', '🤝', '#8b5cf6', strftime('%s', 'now')),
  ('badge-5', 'trusted-user', 'Trusted User', 'Trusted community member', '✓', '#06b6d4', strftime('%s', 'now'));


CREATE TABLE user_badges (
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, badge_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);


-- ============================================
-- INBOX (System messages only)
-- ============================================

CREATE TABLE inbox_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message_encrypted TEXT NOT NULL,
  metadata_json TEXT,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_inbox_type CHECK (type IN ('badge-assigned', 'badge-revoked', 'role-changed', 'system-notification'))
);

CREATE INDEX idx_inbox_user_id ON inbox_messages(user_id);
CREATE INDEX idx_inbox_unread ON inbox_messages(user_id, is_read);
CREATE INDEX idx_inbox_created ON inbox_messages(created_at DESC);
