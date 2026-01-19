const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * FileReferencesRepository - Manages file/folder references (workspace-scoped)
 */
class FileReferencesRepository {
  constructor(db, encryptionService) {
    this.db = db;
    this.encryption = encryptionService;
  }

  create({ workspaceId, userId, name, path, type, description = null, tags = null, isPinned = false }) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();
    const pathEncrypted = this.encryption.encrypt(path);
    const descriptionEncrypted = description ? this.encryption.encrypt(description) : null;

    const stmt = this.db.prepare(`
      INSERT INTO file_references (id, workspace_id, user_id, name, path_encrypted, type, description_encrypted, tags, is_pinned, created_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    stmt.run(id, workspaceId, userId, name, pathEncrypted, type, descriptionEncrypted, tags, isPinned ? 1 : 0, now);
    return this.findById(id);
  }

  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM file_references WHERE id = ?');
    const file = stmt.get(id);
    if (file) {
      file.path = this.encryption.decrypt(file.path_encrypted);
      file.description = file.description_encrypted ? this.encryption.decrypt(file.description_encrypted) : null;
      delete file.path_encrypted;
      delete file.description_encrypted;
    }
    return file;
  }

  findByWorkspace(workspaceId, type = null) {
    let stmt;
    let files;

    if (type) {
      stmt = this.db.prepare('SELECT * FROM file_references WHERE workspace_id = ? AND type = ? ORDER BY is_pinned DESC, created_at DESC');
      files = stmt.all(workspaceId, type);
    } else {
      stmt = this.db.prepare('SELECT * FROM file_references WHERE workspace_id = ? ORDER BY is_pinned DESC, created_at DESC');
      files = stmt.all(workspaceId);
    }

    return files.map(file => ({
      ...file,
      path: this.encryption.decrypt(file.path_encrypted),
      description: file.description_encrypted ? this.encryption.decrypt(file.description_encrypted) : null,
      path_encrypted: undefined,
      description_encrypted: undefined
    }));
  }

  search(workspaceId, query) {
    const stmt = this.db.prepare(`
      SELECT * FROM file_references
      WHERE workspace_id = ? AND (name LIKE ? OR tags LIKE ?)
      ORDER BY created_at DESC
    `);
    const searchTerm = `%${query}%`;
    const files = stmt.all(workspaceId, searchTerm, searchTerm);
    return files.map(file => ({
      ...file,
      path: this.encryption.decrypt(file.path_encrypted),
      description: file.description_encrypted ? this.encryption.decrypt(file.description_encrypted) : null,
      path_encrypted: undefined,
      description_encrypted: undefined
    }));
  }

  update(id, { name, path, type, description, tags, isPinned }) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (path !== undefined) {
      updates.push('path_encrypted = ?');
      params.push(this.encryption.encrypt(path));
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (description !== undefined) {
      updates.push('description_encrypted = ?');
      params.push(description ? this.encryption.encrypt(description) : null);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags);
    }
    if (isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(isPinned ? 1 : 0);
    }

    if (updates.length === 0) return;

    params.push(id);
    const stmt = this.db.prepare(`UPDATE file_references SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
  }

  updateLastAccessed(id) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE file_references SET last_accessed_at = ? WHERE id = ?');
    stmt.run(now, id);
  }

  delete(id) {
    const stmt = this.db.prepare('DELETE FROM file_references WHERE id = ?');
    stmt.run(id);
  }

  count(workspaceId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM file_references WHERE workspace_id = ?');
    return stmt.get(workspaceId).count;
  }

  isOwner(fileId, userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM file_references WHERE id = ? AND user_id = ?');
    return stmt.get(fileId, userId).count > 0;
  }
}

module.exports = FileReferencesRepository;
