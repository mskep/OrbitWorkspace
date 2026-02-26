const crypto = require('crypto');

const ENCRYPTION_VERSION = 'v1';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VALID_TYPES = new Set(['password', 'token', 'api_key', 'secure_note']);

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * VaultRepository - manages encrypted secret vault items.
 *
 * Sensitive payload fields are encrypted before persistence:
 * - secret
 * - username
 * - website
 * - note
 * - is_pinned
 */
class VaultRepository {
  constructor(db, encryptionService) {
    this.db = db;
    this.encryption = encryptionService;
  }

  _normalizeType(type) {
    if (!VALID_TYPES.has(type)) return 'password';
    return type;
  }

  _toEncryptedParts(payload) {
    const encrypted = this.encryption.encrypt(JSON.stringify(payload || {}));
    const [version, encoded] = String(encrypted || '').split(':');

    if (version !== ENCRYPTION_VERSION || !encoded) {
      throw new Error('Invalid encrypted vault payload format');
    }

    const combined = Buffer.from(encoded, 'base64');
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    return {
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  _fromEncryptedParts(row) {
    const iv = Buffer.from(row.iv, 'base64');
    const ciphertext = Buffer.from(row.ciphertext, 'base64');
    const tag = Buffer.from(row.tag, 'base64');
    const combined = Buffer.concat([iv, ciphertext, tag]);
    const decoded = this.encryption.decrypt(`${ENCRYPTION_VERSION}:${combined.toString('base64')}`);
    return JSON.parse(decoded || '{}');
  }

  _mapRow(row) {
    const payload = this._fromEncryptedParts(row);
    return {
      ...row,
      type: this._normalizeType(row.type),
      secret: payload.secret || '',
      username: payload.username || '',
      website: payload.website || '',
      note: payload.note || '',
      is_pinned: payload.is_pinned ? 1 : 0,
      iv: undefined,
      ciphertext: undefined,
      tag: undefined,
    };
  }

  _sortItems(items) {
    return items.sort((a, b) => {
      const pinDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
      if (pinDelta !== 0) return pinDelta;

      const archiveDelta = Number(Boolean(a.is_archived)) - Number(Boolean(b.is_archived));
      if (archiveDelta !== 0) return archiveDelta;

      return (b.updated_at || 0) - (a.updated_at || 0);
    });
  }

  create({
    workspaceId,
    userId,
    type,
    title,
    secret = '',
    username = '',
    website = '',
    note = '',
    tags = '',
    isArchived = false,
    isPinned = false,
  }) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();
    const normalizedType = this._normalizeType(type);
    const encrypted = this._toEncryptedParts({
      secret,
      username,
      website,
      note,
      is_pinned: isPinned ? 1 : 0,
    });

    const stmt = this.db.prepare(`
      INSERT INTO vault_items (
        id, workspace_id, user_id, type, title, iv, ciphertext, tag,
        tags, is_archived, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      workspaceId,
      userId,
      normalizedType,
      title,
      encrypted.iv,
      encrypted.ciphertext,
      encrypted.tag,
      tags || '',
      isArchived ? 1 : 0,
      now,
      now,
    );

    return this.findById(id);
  }

  upsertFromSync({
    id,
    workspaceId,
    userId,
    type,
    title,
    secret = '',
    username = '',
    website = '',
    note = '',
    tags = '',
    isArchived = false,
    isPinned = false,
  }) {
    const now = Math.floor(Date.now() / 1000);
    const normalizedType = this._normalizeType(type);
    const encrypted = this._toEncryptedParts({
      secret,
      username,
      website,
      note,
      is_pinned: isPinned ? 1 : 0,
    });
    const existing = this.db.prepare('SELECT created_at FROM vault_items WHERE id = ?').get(id);
    const createdAt = existing?.created_at || now;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vault_items (
        id, workspace_id, user_id, type, title, iv, ciphertext, tag,
        tags, is_archived, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      workspaceId,
      userId,
      normalizedType,
      title,
      encrypted.iv,
      encrypted.ciphertext,
      encrypted.tag,
      tags || '',
      isArchived ? 1 : 0,
      createdAt,
      now,
    );

    return this.findById(id);
  }

  findById(id) {
    const row = this.db.prepare('SELECT * FROM vault_items WHERE id = ?').get(id);
    if (!row) return null;
    return this._mapRow(row);
  }

  findByWorkspace(workspaceId, { includeArchived = false, type = null } = {}) {
    const clauses = ['workspace_id = ?'];
    const params = [workspaceId];

    if (!includeArchived) {
      clauses.push('is_archived = 0');
    }

    if (type && VALID_TYPES.has(type)) {
      clauses.push('type = ?');
      params.push(type);
    }

    const query = `
      SELECT * FROM vault_items
      WHERE ${clauses.join(' AND ')}
      ORDER BY updated_at DESC
    `;

    const rows = this.db.prepare(query).all(...params);
    const validRows = [];

    for (const row of rows) {
      try {
        validRows.push(this._mapRow(row));
      } catch (error) {
        console.warn(`Skipping corrupted vault item ${row.id}:`, error.message);
      }
    }

    return this._sortItems(validRows);
  }

  search(workspaceId, query, { includeArchived = false, type = null } = {}) {
    const clauses = ['workspace_id = ?', '(title LIKE ? OR tags LIKE ?)'];
    const searchTerm = `%${query || ''}%`;
    const params = [workspaceId, searchTerm, searchTerm];

    if (!includeArchived) {
      clauses.push('is_archived = 0');
    }

    if (type && VALID_TYPES.has(type)) {
      clauses.push('type = ?');
      params.push(type);
    }

    const sql = `
      SELECT * FROM vault_items
      WHERE ${clauses.join(' AND ')}
      ORDER BY updated_at DESC
    `;

    const rows = this.db.prepare(sql).all(...params);
    const validRows = [];

    for (const row of rows) {
      try {
        validRows.push(this._mapRow(row));
      } catch (error) {
        console.warn(`Skipping corrupted vault item ${row.id}:`, error.message);
      }
    }

    return this._sortItems(validRows);
  }

  update(id, updates = {}) {
    const existing = this.db.prepare('SELECT * FROM vault_items WHERE id = ?').get(id);
    if (!existing) return null;

    const now = Math.floor(Date.now() / 1000);
    const fields = [];
    const params = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }

    if (updates.type !== undefined) {
      fields.push('type = ?');
      params.push(this._normalizeType(updates.type));
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      params.push(updates.tags || '');
    }

    if (updates.isArchived !== undefined) {
      fields.push('is_archived = ?');
      params.push(updates.isArchived ? 1 : 0);
    }

    const secretPatch = {};
    let shouldReEncrypt = false;

    for (const key of ['secret', 'username', 'website', 'note']) {
      if (updates[key] !== undefined) {
        secretPatch[key] = updates[key] || '';
        shouldReEncrypt = true;
      }
    }

    if (updates.isPinned !== undefined || updates.is_pinned !== undefined) {
      const pinned = updates.isPinned !== undefined ? updates.isPinned : updates.is_pinned;
      secretPatch.is_pinned = pinned ? 1 : 0;
      shouldReEncrypt = true;
    }

    if (shouldReEncrypt) {
      const currentPayload = this._fromEncryptedParts(existing);
      const mergedPayload = {
        secret: currentPayload.secret || '',
        username: currentPayload.username || '',
        website: currentPayload.website || '',
        note: currentPayload.note || '',
        is_pinned: currentPayload.is_pinned ? 1 : 0,
        ...secretPatch,
      };

      const encrypted = this._toEncryptedParts(mergedPayload);
      fields.push('iv = ?', 'ciphertext = ?', 'tag = ?');
      params.push(encrypted.iv, encrypted.ciphertext, encrypted.tag);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    params.push(now, id);

    this.db.prepare(`UPDATE vault_items SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  toggleArchived(id) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      UPDATE vault_items
      SET is_archived = CASE WHEN is_archived = 1 THEN 0 ELSE 1 END, updated_at = ?
      WHERE id = ?
    `).run(now, id);

    return this.findById(id);
  }

  togglePinned(id) {
    const item = this.findById(id);
    if (!item) return null;
    return this.update(id, { isPinned: !Boolean(item.is_pinned) });
  }

  delete(id) {
    this.db.prepare('DELETE FROM vault_items WHERE id = ?').run(id);
  }

  isOwner(itemId, userId) {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM vault_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    return row.count > 0;
  }
}

module.exports = VaultRepository;