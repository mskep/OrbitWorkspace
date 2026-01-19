const crypto = require('crypto');

/**
 * Generate unique ID
 */
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * WorkspaceRepository - Manages workspaces
 */
class WorkspaceRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create new workspace
   */
  create(userId, name) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();

    const stmt = this.db.prepare(`
      INSERT INTO workspaces (id, user_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, name, now, now);

    return this.findById(id);
  }

  /**
   * Find workspace by ID
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM workspaces WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Find all workspaces for a user
   */
  findByUserId(userId) {
    const stmt = this.db.prepare('SELECT * FROM workspaces WHERE user_id = ? ORDER BY updated_at DESC');
    return stmt.all(userId);
  }

  /**
   * Find workspace by name (for a specific user)
   */
  findByName(userId, name) {
    const stmt = this.db.prepare('SELECT * FROM workspaces WHERE user_id = ? AND name = ?');
    return stmt.get(userId, name);
  }

  /**
   * Update workspace name
   */
  updateName(id, newName) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?');
    stmt.run(newName, now, id);
  }

  /**
   * Update workspace timestamp
   */
  touch(id) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?');
    stmt.run(now, id);
  }

  /**
   * Delete workspace
   */
  delete(id) {
    const stmt = this.db.prepare('DELETE FROM workspaces WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Count workspaces for a user
   */
  count(userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM workspaces WHERE user_id = ?');
    return stmt.get(userId).count;
  }

  /**
   * Check if user owns workspace
   */
  isOwner(workspaceId, userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM workspaces WHERE id = ? AND user_id = ?');
    return stmt.get(workspaceId, userId).count > 0;
  }

  /**
   * Get workspace with tools
   */
  findWithTools(workspaceId) {
    const workspace = this.findById(workspaceId);
    if (!workspace) return null;

    const toolsStmt = this.db.prepare(`
      SELECT tool_id, is_visible, display_order, added_at
      FROM workspace_tools
      WHERE workspace_id = ?
      ORDER BY display_order ASC, added_at ASC
    `);

    workspace.tools = toolsStmt.all(workspaceId);
    return workspace;
  }

  /**
   * Add tool to workspace
   */
  addTool(workspaceId, toolId, displayOrder = null) {
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspace_tools (workspace_id, tool_id, is_visible, display_order, added_at)
      VALUES (?, ?, 1, ?, ?)
    `);

    stmt.run(workspaceId, toolId, displayOrder, now);
    this.touch(workspaceId);
  }

  /**
   * Remove tool from workspace
   */
  removeTool(workspaceId, toolId) {
    const stmt = this.db.prepare('DELETE FROM workspace_tools WHERE workspace_id = ? AND tool_id = ?');
    stmt.run(workspaceId, toolId);
    this.touch(workspaceId);
  }

  /**
   * Update tool visibility
   */
  updateToolVisibility(workspaceId, toolId, isVisible) {
    const stmt = this.db.prepare(`
      UPDATE workspace_tools
      SET is_visible = ?
      WHERE workspace_id = ? AND tool_id = ?
    `);
    stmt.run(isVisible ? 1 : 0, workspaceId, toolId);
    this.touch(workspaceId);
  }

  /**
   * Get tools for workspace
   */
  getTools(workspaceId) {
    const stmt = this.db.prepare(`
      SELECT tool_id, is_visible, display_order, added_at
      FROM workspace_tools
      WHERE workspace_id = ?
      ORDER BY display_order ASC, added_at ASC
    `);
    return stmt.all(workspaceId);
  }
}

module.exports = WorkspaceRepository;
