/**
 * UserCryptoRepository - CRUD for user_crypto table
 *
 * Stores per-user encryption material for zero-knowledge sync:
 *   - salt: Argon2id salt (hex)
 *   - encrypted_master_key: masterKey wrapped by password-derived key (base64)
 *   - recovery_blob: masterKey wrapped by recoveryKey (base64)
 *   - kdf_params: JSON of Argon2id parameters (for future upgradability)
 *   - key_version: integer for key rotation tracking
 */
class UserCryptoRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create crypto entry for a user (called during registration)
   */
  create({ userId, salt, encryptedMasterKey, recoveryBlob, kdfParams }) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO user_crypto (user_id, salt, encrypted_master_key, recovery_blob, kdf_params, key_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      userId,
      salt,
      encryptedMasterKey,
      recoveryBlob,
      JSON.stringify(kdfParams),
      now,
      now
    );
  }

  /**
   * Get crypto material for a user (called during login)
   */
  findByUserId(userId) {
    const row = this.db.prepare('SELECT * FROM user_crypto WHERE user_id = ?').get(userId);
    if (!row) return null;

    return {
      ...row,
      kdf_params: JSON.parse(row.kdf_params)
    };
  }

  /**
   * Update encrypted master key + salt (called during password change)
   */
  updatePasswordCrypto(userId, { salt, encryptedMasterKey, kdfParams }) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      UPDATE user_crypto
      SET salt = ?, encrypted_master_key = ?, kdf_params = ?, updated_at = ?
      WHERE user_id = ?
    `).run(salt, encryptedMasterKey, JSON.stringify(kdfParams), now, userId);
  }

  /**
   * Update recovery blob (called during recovery key regeneration)
   */
  updateRecoveryBlob(userId, recoveryBlob) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      UPDATE user_crypto SET recovery_blob = ?, updated_at = ? WHERE user_id = ?
    `).run(recoveryBlob, now, userId);
  }

  /**
   * Increment key version (for future key rotation)
   */
  incrementKeyVersion(userId) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      UPDATE user_crypto SET key_version = key_version + 1, updated_at = ? WHERE user_id = ?
    `).run(now, userId);
  }

  /**
   * Check if user has crypto material
   */
  exists(userId) {
    const row = this.db.prepare('SELECT 1 FROM user_crypto WHERE user_id = ?').get(userId);
    return !!row;
  }
}

module.exports = UserCryptoRepository;
