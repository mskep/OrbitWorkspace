const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * NotesRepository - Manages notes (workspace-scoped)
 */
class NotesRepository {
  constructor(db, encryptionService) {
    this.db = db;
    this.encryption = encryptionService;
  }

  create({ workspaceId, userId, title, content, tags = null, isPinned = false }) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();
    const contentEncrypted = this.encryption.encrypt(content);

    const stmt = this.db.prepare(`
      INSERT INTO notes (id, workspace_id, user_id, title, content_encrypted, tags, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, workspaceId, userId, title, contentEncrypted, tags, isPinned ? 1 : 0, now, now);
    return this.findById(id);
  }

  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM notes WHERE id = ?');
    const note = stmt.get(id);
    if (note) {
      note.content = this.encryption.decrypt(note.content_encrypted);
      delete note.content_encrypted;
    }
    return note;
  }

  findByWorkspace(workspaceId) {
    const stmt = this.db.prepare('SELECT * FROM notes WHERE workspace_id = ? ORDER BY is_pinned DESC, updated_at DESC');
    const notes = stmt.all(workspaceId);

    // Filter out notes that can't be decrypted (corrupted or wrong key)
    const corruptedIds = [];
    const validNotes = notes.map(note => {
      try {
        return {
          ...note,
          content: this.encryption.decrypt(note.content_encrypted),
          content_encrypted: undefined
        };
      } catch (error) {
        corruptedIds.push(note.id);
        return null; // Will be filtered out
      }
    }).filter(note => note !== null);

    if (corruptedIds.length > 0) {
      console.warn(`⚠️  Skipped ${corruptedIds.length} corrupted note(s) in workspace ${workspaceId}`);
    }

    return validNotes;
  }

  findByUser(userId) {
    const stmt = this.db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC');
    const notes = stmt.all(userId);

    const corruptedIds = [];
    const validNotes = notes.map(note => {
      try {
        return {
          ...note,
          content: this.encryption.decrypt(note.content_encrypted),
          content_encrypted: undefined
        };
      } catch (error) {
        corruptedIds.push(note.id);
        return null;
      }
    }).filter(note => note !== null);

    if (corruptedIds.length > 0) {
      console.warn(`⚠️  Skipped ${corruptedIds.length} corrupted note(s) for user ${userId}`);
    }

    return validNotes;
  }

  search(workspaceId, query) {
    const stmt = this.db.prepare(`
      SELECT * FROM notes
      WHERE workspace_id = ? AND (title LIKE ? OR tags LIKE ?)
      ORDER BY updated_at DESC
    `);
    const searchTerm = `%${query}%`;
    const notes = stmt.all(workspaceId, searchTerm, searchTerm);

    const corruptedIds = [];
    const validNotes = notes.map(note => {
      try {
        return {
          ...note,
          content: this.encryption.decrypt(note.content_encrypted),
          content_encrypted: undefined
        };
      } catch (error) {
        corruptedIds.push(note.id);
        return null;
      }
    }).filter(note => note !== null);

    if (corruptedIds.length > 0) {
      console.warn(`⚠️  Skipped ${corruptedIds.length} corrupted note(s) in search`);
    }

    return validNotes;
  }

  update(id, { title, content, tags, isPinned }) {
    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updates.push('content_encrypted = ?');
      params.push(this.encryption.encrypt(content));
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

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = this.db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
  }

  delete(id) {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
    stmt.run(id);
  }

  togglePin(id) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE notes SET is_pinned = NOT is_pinned, updated_at = ? WHERE id = ?');
    stmt.run(now, id);
  }

  count(workspaceId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM notes WHERE workspace_id = ?');
    return stmt.get(workspaceId).count;
  }

  isOwner(noteId, userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM notes WHERE id = ? AND user_id = ?');
    return stmt.get(noteId, userId).count > 0;
  }
}

module.exports = NotesRepository;
