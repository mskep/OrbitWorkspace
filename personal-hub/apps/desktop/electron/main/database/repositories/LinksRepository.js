const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * LinksRepository - Manages links (workspace-scoped)
 */
class LinksRepository {
  constructor(db, encryptionService) {
    this.db = db;
    this.encryption = encryptionService;
  }

  create({ workspaceId, userId, title, url, description = null, tags = null, faviconUrl = null, isFavorite = false }) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();
    const urlEncrypted = this.encryption.encrypt(url);
    const descriptionEncrypted = description ? this.encryption.encrypt(description) : null;

    const stmt = this.db.prepare(`
      INSERT INTO links (id, workspace_id, user_id, title, url_encrypted, description_encrypted, tags, favicon_url, is_favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, workspaceId, userId, title, urlEncrypted, descriptionEncrypted, tags, faviconUrl, isFavorite ? 1 : 0, now, now);
    return this.findById(id);
  }

  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM links WHERE id = ?');
    const link = stmt.get(id);
    if (link) {
      link.url = this.encryption.decrypt(link.url_encrypted);
      link.description = link.description_encrypted ? this.encryption.decrypt(link.description_encrypted) : null;
      delete link.url_encrypted;
      delete link.description_encrypted;
    }
    return link;
  }

  findByWorkspace(workspaceId) {
    const stmt = this.db.prepare('SELECT * FROM links WHERE workspace_id = ? ORDER BY is_favorite DESC, updated_at DESC');
    const links = stmt.all(workspaceId);
    return links.map(link => ({
      ...link,
      url: this.encryption.decrypt(link.url_encrypted),
      description: link.description_encrypted ? this.encryption.decrypt(link.description_encrypted) : null,
      url_encrypted: undefined,
      description_encrypted: undefined
    }));
  }

  search(workspaceId, query) {
    const stmt = this.db.prepare(`
      SELECT * FROM links
      WHERE workspace_id = ? AND (title LIKE ? OR tags LIKE ?)
      ORDER BY updated_at DESC
    `);
    const searchTerm = `%${query}%`;
    const links = stmt.all(workspaceId, searchTerm, searchTerm);
    return links.map(link => ({
      ...link,
      url: this.encryption.decrypt(link.url_encrypted),
      description: link.description_encrypted ? this.encryption.decrypt(link.description_encrypted) : null,
      url_encrypted: undefined,
      description_encrypted: undefined
    }));
  }

  update(id, { title, url, description, tags, faviconUrl, isFavorite }) {
    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (url !== undefined) {
      updates.push('url_encrypted = ?');
      params.push(this.encryption.encrypt(url));
    }
    if (description !== undefined) {
      updates.push('description_encrypted = ?');
      params.push(description ? this.encryption.encrypt(description) : null);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags);
    }
    if (faviconUrl !== undefined) {
      updates.push('favicon_url = ?');
      params.push(faviconUrl);
    }
    if (isFavorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(isFavorite ? 1 : 0);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = this.db.prepare(`UPDATE links SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
  }

  delete(id) {
    const stmt = this.db.prepare('DELETE FROM links WHERE id = ?');
    stmt.run(id);
  }

  count(workspaceId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM links WHERE workspace_id = ?');
    return stmt.get(workspaceId).count;
  }

  isOwner(linkId, userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM links WHERE id = ? AND user_id = ?');
    return stmt.get(linkId, userId).count > 0;
  }
}

module.exports = LinksRepository;
