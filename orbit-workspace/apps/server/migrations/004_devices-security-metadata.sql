-- ============================================================
-- Orbit Sync Server — Device security metadata
-- Migration 004
-- ============================================================

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_ip INET,
  ADD COLUMN IF NOT EXISTS last_ip_masked TEXT,
  ADD COLUMN IF NOT EXISTS last_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS last_country TEXT,
  ADD COLUMN IF NOT EXISTS last_region TEXT,
  ADD COLUMN IF NOT EXISTS last_city TEXT;
