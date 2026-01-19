const crypto = require('crypto');

/**
 * EncryptionService - AES-256-GCM encryption for sensitive data
 *
 * Format: v1:base64(12-byte-iv + ciphertext + 16-byte-tag)
 * Algorithm: AES-256-GCM with random IV per encryption
 *
 * Master key should be stored in environment variable ORBIT_MASTER_KEY
 * If not provided, generates a random key (WARNING: data will be lost on restart)
 */
class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 12; // 96 bits recommended for GCM
    this.tagLength = 16; // 128 bits auth tag
    this.keyLength = 32; // 256 bits
    this.version = 'v1';

    // Get master key from environment or generate temporary one
    this.masterKey = this._getMasterKey();

    if (!process.env.ORBIT_MASTER_KEY) {
      console.warn('⚠️  ORBIT_MASTER_KEY not set! Using temporary key. Data will be lost on restart!');
      console.warn('   Set ORBIT_MASTER_KEY environment variable for production use.');
    }
  }

  /**
   * Get or generate master encryption key
   */
  _getMasterKey() {
    const envKey = process.env.ORBIT_MASTER_KEY;

    if (envKey) {
      // Derive 32-byte key from environment string using SHA-256
      return crypto.createHash('sha256').update(envKey).digest();
    }

    // Generate random key (WARNING: temporary, data will be lost)
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Encrypt plaintext string
   * @param {string} plaintext - Data to encrypt
   * @returns {string} - Encrypted data in format: v1:base64(iv + ciphertext + tag)
   */
  encrypt(plaintext) {
    if (!plaintext) return null;

    try {
      // Generate random IV for this encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine: iv + ciphertext + tag
      const combined = Buffer.concat([iv, encrypted, tag]);

      // Return versioned base64 string
      return `${this.version}:${combined.toString('base64')}`;
    } catch (error) {
      console.error('Encryption error:', error.message);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt ciphertext
   * @param {string} ciphertext - Encrypted data in format: v1:base64(iv + ciphertext + tag)
   * @returns {string} - Decrypted plaintext
   */
  decrypt(ciphertext) {
    if (!ciphertext) return null;

    try {
      // Parse version and data
      const parts = ciphertext.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid ciphertext format');
      }

      const [version, data] = parts;

      // Check version
      if (version !== this.version) {
        throw new Error(`Unsupported encryption version: ${version}`);
      }

      // Decode base64
      const combined = Buffer.from(data, 'base64');

      // Extract components: iv (12 bytes) + ciphertext + tag (16 bytes)
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(-this.tagLength);
      const encrypted = combined.slice(this.ivLength, -this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(tag);

      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw new Error('Decryption failed - data may be corrupted or key is incorrect');
    }
  }

  /**
   * Encrypt JSON object
   * @param {Object} obj - Object to encrypt
   * @returns {string} - Encrypted JSON string
   */
  encryptJSON(obj) {
    if (!obj) return null;
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt to JSON object
   * @param {string} ciphertext - Encrypted JSON string
   * @returns {Object} - Decrypted object
   */
  decryptJSON(ciphertext) {
    if (!ciphertext) return null;
    const json = this.decrypt(ciphertext);
    return JSON.parse(json);
  }

  /**
   * Check if a string is encrypted (has version prefix)
   * @param {string} str - String to check
   * @returns {boolean}
   */
  isEncrypted(str) {
    return str && typeof str === 'string' && str.startsWith(`${this.version}:`);
  }

  /**
   * Rotate master key and re-encrypt all data
   * (To be implemented when needed for key rotation)
   */
  rotateKey(newMasterKey) {
    throw new Error('Key rotation not yet implemented');
  }
}

module.exports = EncryptionService;
