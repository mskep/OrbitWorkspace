const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * TokenStore — Persists server tokens (access + refresh) to disk.
 *
 * Tokens are encrypted at rest using a machine-derived key so they
 * can't be trivially read from the filesystem.
 *
 * Structure on disk (JSON):
 *   { iv, data, tag } — AES-256-GCM encrypted blob containing
 *   { access_token, refresh_token, server_user_id, device_id }
 */
class TokenStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, '.cloud-tokens');
    this._tokens = null; // In-memory cache
    this._encKey = this._deriveStorageKey(userDataPath);
  }

  /**
   * Load tokens from disk (call once at startup).
   */
  load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const { iv, data, tag } = JSON.parse(raw);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this._encKey,
        Buffer.from(iv, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      this._tokens = JSON.parse(decrypted);
    } catch {
      // Corrupted or wrong key — treat as no tokens
      this._tokens = null;
      this._deleteFile();
    }
  }

  /**
   * Get current in-memory tokens.
   * @returns {{ access_token, refresh_token, server_user_id, device_id } | null}
   */
  getTokens() {
    return this._tokens;
  }

  /**
   * Save tokens to memory + disk.
   * Merges with existing tokens (preserves server_user_id/device_id if not provided).
   */
  saveTokens(tokens) {
    this._tokens = { ...this._tokens, ...tokens };
    this._persist();
  }

  /**
   * Clear all tokens (logout).
   */
  clearTokens() {
    this._tokens = null;
    this._deleteFile();
  }

  /**
   * Check if cloud tokens exist.
   */
  isConnected() {
    return !!(this._tokens?.access_token && this._tokens?.refresh_token);
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  _persist() {
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this._encKey, iv);

      const plaintext = JSON.stringify(this._tokens);
      let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');

      fs.writeFileSync(this.filePath, JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        tag,
      }), 'utf-8');
    } catch (err) {
      console.error('TokenStore: failed to persist tokens:', err.message);
    }
  }

  _deleteFile() {
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
    } catch { /* non-critical */ }
  }

  /**
   * Derive a storage encryption key from the user data path.
   * This is NOT meant to protect against a targeted attacker with disk access,
   * but prevents casual reading of tokens from the filesystem.
   */
  _deriveStorageKey(seed) {
    return crypto.createHash('sha256')
      .update(`orbit-token-store:${seed}`)
      .digest();
  }
}

module.exports = TokenStore;
