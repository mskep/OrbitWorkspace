const crypto = require('crypto');
const argon2 = require('argon2');

/**
 * BIP39-inspired wordlist (2048 words) for recovery phrase encoding.
 * Using a minimal subset — full BIP39 wordlist can be loaded from file if needed.
 * For now, we generate recovery keys as hex strings and offer file-based recovery.
 */

// Default KDF params — stored per-user in DB for future upgradability
const DEFAULT_KDF_PARAMS = {
  algorithm: 'argon2id',
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
  hashLength: 32,       // 256-bit output
};

const AES_CONFIG = {
  algorithm: 'aes-256-gcm',
  ivLength: 12,         // 96-bit IV (recommended for GCM)
  tagLength: 16,        // 128-bit auth tag
};

/**
 * SyncCrypto — Zero-knowledge encryption for Orbit sync
 *
 * Key hierarchy:
 *   password → Argon2id → derivedKey → wraps masterKey
 *   masterKey → AES-256-GCM → encrypts all user data
 *   recoveryKey → wraps masterKey (stored as .orbit-recovery file)
 *
 * The server NEVER receives: password, derivedKey, masterKey, or recoveryKey.
 * The server stores: salt, encryptedMasterKey, recoveryBlob (all opaque).
 */
class SyncCrypto {
  constructor() {
    this.masterKey = null; // Held in memory only while session is active
  }

  // ============================================================
  // KEY DERIVATION
  // ============================================================

  /**
   * Derive a 256-bit key from password using Argon2id
   * @param {string} password - User's password
   * @param {Buffer} salt - 16-byte random salt
   * @param {Object} [kdfParams] - Optional KDF params override (from DB for existing users)
   * @returns {Promise<Buffer>} - 32-byte derived key
   */
  async deriveKey(password, salt, kdfParams = null) {
    const params = kdfParams || DEFAULT_KDF_PARAMS;
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: params.memoryCost,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
      hashLength: params.hashLength,
      salt,
      raw: true,
    });
    return hash;
  }

  /**
   * Get default KDF params (for storage in user_crypto.kdf_params)
   * @returns {Object}
   */
  getDefaultKdfParams() {
    return { ...DEFAULT_KDF_PARAMS };
  }

  /**
   * Generate a unique operation ID for sync queue idempotency
   * @returns {string}
   */
  generateOpId() {
    return crypto.randomUUID();
  }

  /**
   * Generate a cryptographically random salt
   * @returns {Buffer} - 16-byte random salt
   */
  generateSalt() {
    return crypto.randomBytes(16);
  }

  /**
   * Generate a cryptographically random 256-bit key
   * @returns {Buffer} - 32-byte random key
   */
  generateKey() {
    return crypto.randomBytes(32);
  }

  // ============================================================
  // REGISTRATION FLOW
  // ============================================================

  /**
   * Generate all crypto material for a new user registration.
   *
   * @param {string} password - User's chosen password
   * @returns {Promise<Object>} Registration crypto bundle:
   *   - salt: hex string (store on server)
   *   - encryptedMasterKey: base64 string (store on server)
   *   - recoveryBlob: base64 string (store on server)
   *   - recoveryKey: hex string (export to .orbit-recovery file, NEVER store on server)
   *   - masterKey: Buffer (keep in memory only)
   */
  async generateRegistrationBundle(password) {
    const salt = this.generateSalt();
    const masterKey = this.generateKey();
    const recoveryKey = this.generateKey();

    // Derive key from password
    const derivedKey = await this.deriveKey(password, salt);

    // Wrap masterKey with derivedKey
    const encryptedMasterKey = this._wrapKey(masterKey, derivedKey);

    // Wrap masterKey with recoveryKey (for password reset)
    const recoveryBlob = this._wrapKey(masterKey, recoveryKey);

    // Keep masterKey in memory
    this.masterKey = masterKey;

    return {
      salt: salt.toString('hex'),
      encryptedMasterKey: encryptedMasterKey.toString('base64'),
      recoveryBlob: recoveryBlob.toString('base64'),
      recoveryKey: recoveryKey.toString('hex'),
      kdfParams: this.getDefaultKdfParams(),
      masterKey,
    };
  }

  // ============================================================
  // LOGIN FLOW
  // ============================================================

  /**
   * Unlock masterKey from encrypted storage using password.
   *
   * @param {string} password - User's password
   * @param {string} saltHex - Salt as hex string (from server)
   * @param {string} encryptedMasterKeyB64 - Encrypted master key as base64 (from server)
   * @param {Object} [kdfParams] - KDF params from user_crypto (for users created with different params)
   * @returns {Promise<Buffer>} - Decrypted masterKey (also stored in this.masterKey)
   * @throws {Error} - If password is wrong (decryption will fail)
   */
  async unlockWithPassword(password, saltHex, encryptedMasterKeyB64, kdfParams = null) {
    const salt = Buffer.from(saltHex, 'hex');
    const derivedKey = await this.deriveKey(password, salt, kdfParams);
    const encryptedMasterKey = Buffer.from(encryptedMasterKeyB64, 'base64');

    const masterKey = this._unwrapKey(encryptedMasterKey, derivedKey);
    this.masterKey = masterKey;
    return masterKey;
  }

  /**
   * Unlock masterKey using recovery key (password reset flow).
   *
   * @param {string} recoveryKeyHex - Recovery key as hex string (from .orbit-recovery file)
   * @param {string} recoveryBlobB64 - Recovery blob as base64 (from server)
   * @returns {Buffer} - Decrypted masterKey
   */
  unlockWithRecoveryKey(recoveryKeyHex, recoveryBlobB64) {
    const recoveryKey = Buffer.from(recoveryKeyHex, 'hex');
    const recoveryBlob = Buffer.from(recoveryBlobB64, 'base64');

    const masterKey = this._unwrapKey(recoveryBlob, recoveryKey);
    this.masterKey = masterKey;
    return masterKey;
  }

  // ============================================================
  // PASSWORD CHANGE
  // ============================================================

  /**
   * Re-wrap masterKey with a new password. Data is NOT re-encrypted.
   *
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} saltHex - Current salt (hex)
   * @param {string} encryptedMasterKeyB64 - Current encrypted master key (base64)
   * @returns {Promise<Object>} New crypto material:
   *   - salt: new hex string
   *   - encryptedMasterKey: new base64 string
   */
  async changePassword(oldPassword, newPassword, saltHex, encryptedMasterKeyB64) {
    // Decrypt masterKey with old password
    const masterKey = await this.unlockWithPassword(oldPassword, saltHex, encryptedMasterKeyB64);

    // Generate new salt and derive new key
    const newSalt = this.generateSalt();
    const newDerivedKey = await this.deriveKey(newPassword, newSalt);

    // Re-wrap masterKey with new derived key
    const newEncryptedMasterKey = this._wrapKey(masterKey, newDerivedKey);

    return {
      salt: newSalt.toString('hex'),
      encryptedMasterKey: newEncryptedMasterKey.toString('base64'),
    };
  }

  // ============================================================
  // DATA ENCRYPTION (for sync blobs)
  // ============================================================

  /**
   * Encrypt data for sync. Uses AES-256-GCM with AAD.
   *
   * @param {string} plaintext - JSON string to encrypt
   * @param {Object} aad - Additional Authenticated Data (prevents blob swapping)
   * @param {string} aad.userId
   * @param {string} aad.entityType
   * @param {string} aad.entityId
   * @param {number} aad.version
   * @returns {Object} Encrypted blob: { iv, ciphertext, tag } (all base64)
   * @throws {Error} If masterKey is not loaded
   */
  encryptForSync(plaintext, aad) {
    if (!this.masterKey) {
      throw new Error('Master key not loaded. Call unlockWithPassword() first.');
    }

    const iv = crypto.randomBytes(AES_CONFIG.ivLength);
    const aadBuffer = Buffer.from(
      `${aad.userId}|${aad.entityType}|${aad.entityId}|${aad.version}`
    );

    const cipher = crypto.createCipheriv(AES_CONFIG.algorithm, this.masterKey, iv);
    cipher.setAAD(aadBuffer);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /**
   * Decrypt a sync blob.
   *
   * @param {Object} blob - { iv, ciphertext, tag } (all base64)
   * @param {Object} aad - Same AAD used during encryption
   * @returns {string} Decrypted plaintext (JSON string)
   */
  decryptFromSync(blob, aad) {
    if (!this.masterKey) {
      throw new Error('Master key not loaded. Call unlockWithPassword() first.');
    }

    const iv = Buffer.from(blob.iv, 'base64');
    const ciphertext = Buffer.from(blob.ciphertext, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const aadBuffer = Buffer.from(
      `${aad.userId}|${aad.entityType}|${aad.entityId}|${aad.version}`
    );

    const decipher = crypto.createDecipheriv(AES_CONFIG.algorithm, this.masterKey, iv);
    decipher.setAAD(aadBuffer);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  // ============================================================
  // RECOVERY FILE
  // ============================================================

  /**
   * Generate recovery file content.
   * The user saves this file securely — it's the ONLY way to recover data.
   *
   * @param {string} recoveryKeyHex - Recovery key as hex
   * @param {string} username - For file identification
   * @returns {string} File content (plain text)
   */
  generateRecoveryFileContent(recoveryKeyHex, username) {
    const timestamp = new Date().toISOString();
    return [
      '# Orbit Recovery Key',
      `# Account: ${username}`,
      `# Generated: ${timestamp}`,
      '#',
      '# KEEP THIS FILE SAFE. Without it, you CANNOT recover your data',
      '# if you forget your password. Do NOT share this file.',
      '#',
      `ORBIT-RECOVERY-KEY:${recoveryKeyHex}`,
    ].join('\n');
  }

  /**
   * Parse recovery key from file content.
   *
   * @param {string} fileContent - Contents of .orbit-recovery file
   * @returns {string} Recovery key as hex
   * @throws {Error} If file format is invalid
   */
  parseRecoveryFile(fileContent) {
    const lines = fileContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('ORBIT-RECOVERY-KEY:')) {
        const key = line.split(':')[1].trim();
        if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
          return key;
        }
        throw new Error('Invalid recovery key format');
      }
    }
    throw new Error('Recovery key not found in file');
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  /**
   * Check if masterKey is loaded (user is "crypto-unlocked")
   */
  isUnlocked() {
    return this.masterKey !== null;
  }

  /**
   * Clear masterKey from memory (logout / lock)
   */
  lock() {
    if (this.masterKey) {
      // Overwrite buffer with zeros before releasing
      this.masterKey.fill(0);
      this.masterKey = null;
    }
  }

  // ============================================================
  // INTERNAL: Key wrapping (AES-256-GCM)
  // ============================================================

  /**
   * Wrap (encrypt) a key with another key
   * @param {Buffer} keyToWrap - Key to encrypt
   * @param {Buffer} wrappingKey - Key used for encryption
   * @returns {Buffer} - iv + ciphertext + tag concatenated
   */
  _wrapKey(keyToWrap, wrappingKey) {
    const iv = crypto.randomBytes(AES_CONFIG.ivLength);
    const cipher = crypto.createCipheriv(AES_CONFIG.algorithm, wrappingKey, iv);

    let encrypted = cipher.update(keyToWrap);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, encrypted, tag]);
  }

  /**
   * Unwrap (decrypt) a key
   * @param {Buffer} wrappedKey - iv + ciphertext + tag
   * @param {Buffer} wrappingKey - Key used for decryption
   * @returns {Buffer} - Unwrapped key
   */
  _unwrapKey(wrappedKey, wrappingKey) {
    const iv = wrappedKey.subarray(0, AES_CONFIG.ivLength);
    const tag = wrappedKey.subarray(-AES_CONFIG.tagLength);
    const encrypted = wrappedKey.subarray(AES_CONFIG.ivLength, -AES_CONFIG.tagLength);

    const decipher = crypto.createDecipheriv(AES_CONFIG.algorithm, wrappingKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }
}

module.exports = SyncCrypto;
