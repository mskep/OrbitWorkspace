const { ApiClient, ApiError } = require('./ApiClient');
const TokenStore = require('./TokenStore');
const SyncQueue = require('./SyncQueue');
const WebSocketClient = require('./WebSocketClient');

const PUSH_INTERVAL_MS = 10_000; // Try to push every 10s
const PULL_INTERVAL_MS = 60_000; // Full pull every 60s (WS handles real-time)
const CLEANUP_INTERVAL_MS = 3600_000; // Clean old queue entries every hour

/**
 * SyncManager — Orchestrates bidirectional sync between local SQLite and server.
 *
 * Lifecycle:
 *   1. initialize() — loads tokens, sets up queue
 *   2. Auth is handled by authServiceSQLite (which calls start() after login)
 *   3. start() — begins push/pull cycle + WebSocket connection
 *   4. enqueueChange() — called by IPC handlers after local CRUD
 *   5. stop() — pauses sync (on logout or disconnect)
 *
 * The SyncManager never reads/writes local data directly — it delegates
 * encryption to SyncCrypto and local storage to the repositories.
 */
class SyncManager {
  constructor(dbService, authService, networkMonitor, userDataPath) {
    this.dbService = dbService;
    this.authService = authService;
    this.networkMonitor = networkMonitor;

    this.tokenStore = new TokenStore(userDataPath);
    this.apiClient = new ApiClient(this.tokenStore);
    this.syncQueue = null; // Created after DB is ready
    this.wsClient = new WebSocketClient(this.apiClient);

    this._pushTimer = null;
    this._pullTimer = null;
    this._cleanupTimer = null;
    this._auditPushTimer = null;
    this._running = false;
    this._syncing = false;

    // Audit log push buffer
    this._auditLogBuffer = [];
    this._auditLogMaxBuffer = 200;

    // Status for UI
    this._status = 'disconnected'; // disconnected | connecting | synced | syncing | error
    this._lastError = null;
    this._statusListeners = [];
    this._serverEventListeners = [];
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * Initialize the sync system. Call after DB is ready.
   */
  initialize() {
    const db = this.dbService.getDB();
    this.syncQueue = new SyncQueue(db);
    this.syncQueue.resetInFlight(); // Reset any ops stuck from a crash

    // Wire up WS events
    this.wsClient.on('sync_events', (msg) => this._onSyncEvents(msg));
    this.wsClient.on('connected', () => this._setStatus('synced'));
    this.wsClient.on('disconnected', () => {
      if (this._running) this._setStatus('connecting');
    });
    this.wsClient.on('error', (err) => {
      console.error('SyncManager WS error:', err.message);
    });

    // Server-authoritative WS events (inbox, badges, admin broadcast)
    this.wsClient.on('inbox_message', (msg) => this._onServerEvent('inbox_message', msg.data));
    this.wsClient.on('badge_update', (msg) => this._onServerEvent('badge_update', msg.data));
    this.wsClient.on('admin_broadcast', (msg) => this._onServerEvent('admin_broadcast', msg.data));

    // Note: tokenStore.load() is called by authService.restoreSession()
    // start() is called by authService after successful login/unlock
  }

  /**
   * Start the sync engine (push/pull cycles + WebSocket).
   * Called by authService after login or unlock.
   */
  async start() {
    if (this._running) return;
    if (!this.tokenStore.isConnected()) return;

    this._running = true;
    this._setStatus('connecting');

    // Initial full pull
    try {
      await this._pull();
      await this._push();
    } catch (err) {
      console.error('SyncManager initial sync failed:', err.message);
    }

    // Start periodic sync
    this._pushTimer = setInterval(() => this._push().catch(console.error), PUSH_INTERVAL_MS);
    this._pullTimer = setInterval(() => this._pull().catch(console.error), PULL_INTERVAL_MS);
    this._cleanupTimer = setInterval(() => this.syncQueue.cleanup(), CLEANUP_INTERVAL_MS);
    this._auditPushTimer = setInterval(() => this._flushAuditLogs().catch(console.error), 30_000);

    // Connect WebSocket for real-time notifications
    this.wsClient.connect().catch(console.error);
  }

  /**
   * Stop the sync engine.
   */
  stop() {
    this._running = false;
    if (this._pushTimer) { clearInterval(this._pushTimer); this._pushTimer = null; }
    if (this._pullTimer) { clearInterval(this._pullTimer); this._pullTimer = null; }
    if (this._cleanupTimer) { clearInterval(this._cleanupTimer); this._cleanupTimer = null; }
    if (this._auditPushTimer) { clearInterval(this._auditPushTimer); this._auditPushTimer = null; }
    // Flush remaining audit logs before stopping
    this._flushAuditLogs().catch(() => {});
    this.wsClient.disconnect();
    this._setStatus('disconnected');
  }

  // ============================================================
  // ENQUEUE LOCAL CHANGES
  // ============================================================

  /**
   * Called by IPC handlers after a local CRUD operation.
   * Serializes the entity data for later encryption and push.
   */
  enqueueChange(entityType, entityId, action, data = null) {
    if (!this.syncQueue) return;
    if (!this.tokenStore.isConnected()) return;

    // Encrypt payload at rest — never enqueue plaintext to avoid leaking data
    let payload = data;
    if (data) {
      try {
        const syncCrypto = this.authService.getSyncCrypto();
        if (syncCrypto.isUnlocked()) {
          payload = { _enc: syncCrypto.encryptLocal(JSON.stringify(data)) };
        } else {
          console.warn('SyncManager: crypto locked, skipping enqueue for', entityType, entityId);
          return;
        }
      } catch (err) {
        console.error('SyncManager: crypto failed, skipping enqueue:', err.message);
        return;
      }
    }

    this.syncQueue.enqueue(entityType, entityId, action, payload);

    // Trigger immediate push if online
    if (this._running && this.networkMonitor.getStatus()) {
      this._push().catch(console.error);
    }
  }

  // ============================================================
  // PUSH — Local → Server
  // ============================================================

  async _push() {
    if (this._syncing) return;
    if (!this.networkMonitor.getStatus()) return;
    if (!this.tokenStore.isConnected()) return;

    const ops = this.syncQueue.drain(50);
    if (ops.length === 0) return;

    this._syncing = true;
    this._setStatus('syncing');

    try {
      const syncCrypto = this.authService.getSyncCrypto();
      if (!syncCrypto.isUnlocked()) {
        this.syncQueue.resetInFlight();
        return;
      }

      const serverUserId = this.tokenStore.getTokens()?.server_user_id;
      if (!serverUserId) {
        this.syncQueue.resetInFlight();
        return;
      }

      // Encrypt each operation into a sync blob
      const blobs = ops.map((op) => {
        const aad = {
          userId: serverUserId,
          entityType: op.entity_type,
          entityId: op.entity_id,
          version: op.version,
        };

        if (op.action === 'delete') {
          const encrypted = syncCrypto.encryptForSync('{}', aad);
          return {
            op_id: op.op_id,
            entity_type: op.entity_type,
            entity_id: op.entity_id,
            version: op.version,
            iv: encrypted.iv,
            ciphertext: encrypted.ciphertext,
            tag: encrypted.tag,
            deleted: true,
          };
        }

        // Decrypt at-rest payload if it was encrypted during enqueue
        let payloadData = op.payload;
        if (payloadData?._enc) {
          payloadData = JSON.parse(syncCrypto.decryptLocal(payloadData._enc));
        }

        const plaintext = JSON.stringify(payloadData);
        const encrypted = syncCrypto.encryptForSync(plaintext, aad);
        return {
          op_id: op.op_id,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          version: op.version,
          iv: encrypted.iv,
          ciphertext: encrypted.ciphertext,
          tag: encrypted.tag,
          deleted: false,
        };
      });

      const result = await this.apiClient.push(blobs);

      // Mark accepted ops as done
      const acceptedOpIds = result.accepted.map((a) => a.op_id);
      this.syncQueue.markDone(acceptedOpIds);

      // Handle conflicts (server has newer version)
      if (result.conflicts?.length > 0) {
        const conflictOpIds = result.conflicts.map((c) => c.op_id);
        this.syncQueue.markFailed(conflictOpIds);

        for (const conflict of result.conflicts) {
          this.syncQueue.setVersion(conflict.entity_type, conflict.entity_id, conflict.server_version);
        }

        await this._pull();
      }

      this._setStatus('synced');
    } catch (err) {
      console.error('SyncManager push error:', err.message);
      this.syncQueue.resetInFlight();

      if (err instanceof ApiError && err.statusCode === 401) {
        this._setStatus('error');
        this._lastError = 'Session expired';
      } else {
        this._setStatus('error');
        this._lastError = err.message;
      }
    } finally {
      this._syncing = false;
    }
  }

  // ============================================================
  // PULL — Server → Local
  // ============================================================

  async _pull() {
    if (!this.networkMonitor.getStatus()) return;
    if (!this.tokenStore.isConnected()) return;

    const syncCrypto = this.authService.getSyncCrypto();
    if (!syncCrypto.isUnlocked()) return;

    try {
      const since = this.syncQueue.getServerClock('_global');
      const result = await this.apiClient.pull(since);

      if (!result.blobs || result.blobs.length === 0) return;

      const serverUserId = this.tokenStore.getTokens()?.server_user_id;
      const repos = this.dbService.getRepositories();
      const session = await this.authService.getSession();
      if (!session) return;

      // Sort blobs: workspaces first (other entities reference them via FK),
      // then user_settings (needs workspace to exist for active_workspace_id),
      // then content entities last.
      const ENTITY_ORDER = { workspace: 0, user_settings: 1, note: 2, link: 2, file_ref: 2 };
      result.blobs.sort((a, b) => {
        const orderA = ENTITY_ORDER[a.entity_type] ?? 9;
        const orderB = ENTITY_ORDER[b.entity_type] ?? 9;
        if (orderA !== orderB) return orderA - orderB;
        return (a.server_clock ?? a.version) - (b.server_clock ?? b.version);
      });

      // Track the highest server_clock we've successfully processed.
      // server_clock is the global monotonic cursor the server uses for ordering.
      // blob.version is the per-entity version (used for conflict detection, NOT cursor).
      let lastSuccessfulClock = this.syncQueue.getServerClock('_global');

      for (const blob of result.blobs) {
        try {
          const blobClock = blob.server_clock ?? blob.version; // server_clock from server response

          if (blob.deleted) {
            this._handleDeletedBlob(blob, repos);
            if (blobClock > lastSuccessfulClock) lastSuccessfulClock = blobClock;
            continue;
          }

          const aad = {
            userId: serverUserId,
            entityType: blob.entity_type,
            entityId: blob.entity_id,
            version: blob.version,
          };

          const plaintext = syncCrypto.decryptFromSync(blob, aad);
          const data = JSON.parse(plaintext);

          const localVersion = this.syncQueue.getVersion(blob.entity_type, blob.entity_id);
          if (blob.version <= localVersion) {
            if (blobClock > lastSuccessfulClock) lastSuccessfulClock = blobClock;
            continue;
          }

          this._applyPulledEntity(blob.entity_type, blob.entity_id, data, repos, session);
          this.syncQueue.setVersion(blob.entity_type, blob.entity_id, blob.version);
          if (blobClock > lastSuccessfulClock) lastSuccessfulClock = blobClock;
        } catch (err) {
          console.error(`SyncManager: failed to process blob ${blob.entity_type}/${blob.entity_id}:`, err.message);
          // Do NOT advance cursor past failed blobs
        }
      }

      this.syncQueue.setServerClock('_global', lastSuccessfulClock);
    } catch (err) {
      console.error('SyncManager pull error:', err.message);
    }
  }

  /**
   * Ensure the workspace referenced by a pulled entity exists locally.
   * On a fresh install, only the default workspace exists. Synced entities
   * may reference workspaces from another device that don't exist yet.
   */
  _ensureWorkspace(workspaceId, repos, session) {
    // If we have a workspace_id, check if it exists locally
    if (workspaceId) {
      try {
        const existing = repos.workspaces.findById?.(workspaceId);
        if (existing) return workspaceId;
      } catch { /* ignore */ }
    }

    // Workspace doesn't exist locally yet (its blob will be processed separately).
    // Never create placeholder workspaces — just use user's first existing workspace.
    try {
      const userWs = repos.workspaces.findByUserId?.(session.userId);
      if (userWs?.length > 0) return userWs[0].id;
    } catch { /* ignore */ }

    // No workspace at all — workspace blobs are processed first in the sort order,
    // so this is a rare edge case. Never create placeholder workspaces.
    return workspaceId;
  }

  _applyPulledEntity(entityType, entityId, data, repos, session) {
    switch (entityType) {
      case 'note': {
        const existing = repos.notes.findById(entityId);
        if (existing) {
          repos.notes.update(entityId, {
            title: data.title,
            content: data.content,
            tags: data.tags,
            isPinned: data.is_pinned,
          });
        } else {
          const wsId = this._ensureWorkspace(data.workspace_id, repos, session);
          const db = this.dbService.getDB();
          const now = Math.floor(Date.now() / 1000);
          const contentEncrypted = repos.notes.encryption.encrypt(data.content || '');
          db.prepare(`
            INSERT OR REPLACE INTO notes (id, workspace_id, user_id, title, content_encrypted, tags, is_pinned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(entityId, wsId, session.userId, data.title, contentEncrypted, data.tags || '', data.is_pinned ? 1 : 0, now, now);
        }
        break;
      }

      case 'link': {
        const existing = repos.links.findById(entityId);
        if (existing) {
          repos.links.update(entityId, {
            title: data.title,
            url: data.url,
            description: data.description,
            tags: data.tags,
            isFavorite: data.is_favorite,
            faviconUrl: data.favicon_url,
          });
        } else {
          const wsId = this._ensureWorkspace(data.workspace_id, repos, session);
          const db = this.dbService.getDB();
          const now = Math.floor(Date.now() / 1000);
          const urlEncrypted = repos.links.encryption.encrypt(data.url || '');
          const descEncrypted = data.description ? repos.links.encryption.encrypt(data.description) : null;
          db.prepare(`
            INSERT OR REPLACE INTO links (id, workspace_id, user_id, title, url_encrypted, description_encrypted, tags, favicon_url, is_favorite, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(entityId, wsId, session.userId, data.title, urlEncrypted, descEncrypted, data.tags || '', data.favicon_url || null, data.is_favorite ? 1 : 0, now, now);
        }
        break;
      }

      case 'file_ref': {
        const existing = repos.fileReferences?.findById(entityId);
        if (existing) {
          repos.fileReferences.update(entityId, {
            name: data.name,
            path: data.path,
            description: data.description,
            tags: data.tags,
            isPinned: data.is_pinned,
          });
        } else if (repos.fileReferences) {
          const wsId = this._ensureWorkspace(data.workspace_id, repos, session);
          const db = this.dbService.getDB();
          const now = Math.floor(Date.now() / 1000);
          const pathEncrypted = repos.fileReferences.encryption.encrypt(data.path || '');
          const descEncrypted = data.description ? repos.fileReferences.encryption.encrypt(data.description) : null;
          db.prepare(`
            INSERT OR REPLACE INTO file_references (id, workspace_id, user_id, name, path_encrypted, type, description_encrypted, tags, is_pinned, created_at, last_accessed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(entityId, wsId, session.userId, data.name, pathEncrypted, data.type || 'file', descEncrypted, data.tags || '', data.is_pinned ? 1 : 0, now, now);
        }
        break;
      }

      case 'workspace': {
        const existing = repos.workspaces.findById(entityId);
        if (existing) {
          repos.workspaces.updateName(entityId, data.name);
        } else {
          const db = this.dbService.getDB();
          const now = Math.floor(Date.now() / 1000);

          // Handle UNIQUE(user_id, name) conflict: if login auto-created a workspace
          // with the same name but different ID, the server version wins.
          const conflict = db.prepare(
            'SELECT id FROM workspaces WHERE user_id = ? AND name = ? AND id != ?'
          ).get(session.userId, data.name, entityId);

          if (conflict) {
            // Move any content from the conflicting workspace to the server one
            db.prepare('UPDATE notes SET workspace_id = ? WHERE workspace_id = ?').run(entityId, conflict.id);
            db.prepare('UPDATE links SET workspace_id = ? WHERE workspace_id = ?').run(entityId, conflict.id);
            db.prepare('UPDATE file_references SET workspace_id = ? WHERE workspace_id = ?').run(entityId, conflict.id);
            db.prepare('UPDATE workspace_tools SET workspace_id = ? WHERE workspace_id = ?').run(entityId, conflict.id);
            db.prepare('UPDATE user_settings SET active_workspace_id = ? WHERE active_workspace_id = ?').run(entityId, conflict.id);
            db.prepare('DELETE FROM workspaces WHERE id = ?').run(conflict.id);
          }

          db.prepare(`
            INSERT OR IGNORE INTO workspaces (id, user_id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(entityId, session.userId, data.name, now, now);
        }

        // Reconcile workspace tools
        if (Array.isArray(data.tools)) {
          const currentTools = repos.workspaces.getTools(entityId);
          const currentToolIds = new Set(currentTools.map((t) => t.tool_id));
          const syncedToolIds = new Set(data.tools.map((t) => t.tool_id));

          // Add missing tools
          for (const tool of data.tools) {
            if (!currentToolIds.has(tool.tool_id)) {
              repos.workspaces.addTool(entityId, tool.tool_id, tool.display_order);
            }
          }
          // Remove tools that were removed on remote
          for (const tool of currentTools) {
            if (!syncedToolIds.has(tool.tool_id)) {
              repos.workspaces.removeTool(entityId, tool.tool_id);
            }
          }
        }
        break;
      }

      case 'user_settings': {
        // entityId is the userId for user_settings
        const existing = repos.userSettings.findByUserId(entityId);
        if (existing) {
          const updates = {};
          if (data.theme !== undefined) updates.theme = data.theme;
          if (data.language !== undefined) updates.language = data.language;
          if (data.notifications_enabled !== undefined) updates.notificationsEnabled = !!data.notifications_enabled;
          if (data.auto_launch_enabled !== undefined) updates.autoLaunchEnabled = !!data.auto_launch_enabled;
          if (data.active_workspace_id !== undefined) {
            // Only set active_workspace_id if the workspace exists locally
            const wsExists = repos.workspaces.findById(data.active_workspace_id);
            if (wsExists) updates.activeWorkspaceId = data.active_workspace_id;
          }
          if (data.additionalSettings !== undefined) updates.additionalSettings = data.additionalSettings;

          repos.userSettings.update(entityId, updates);
        } else {
          repos.userSettings.create(entityId, data.active_workspace_id || null);
          const updates = {};
          if (data.theme) updates.theme = data.theme;
          if (data.language) updates.language = data.language;
          if (data.notifications_enabled !== undefined) updates.notificationsEnabled = !!data.notifications_enabled;
          if (data.auto_launch_enabled !== undefined) updates.autoLaunchEnabled = !!data.auto_launch_enabled;
          if (data.additionalSettings) updates.additionalSettings = data.additionalSettings;
          if (Object.keys(updates).length > 0) {
            repos.userSettings.update(entityId, updates);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  _handleDeletedBlob(blob, repos) {
    try {
      switch (blob.entity_type) {
        case 'note': repos.notes.delete(blob.entity_id); break;
        case 'link': repos.links.delete(blob.entity_id); break;
        case 'file_ref': repos.fileReferences?.delete(blob.entity_id); break;
        case 'workspace': repos.workspaces.delete(blob.entity_id); break;
        // user_settings: don't delete — reset to defaults instead
      }
    } catch { /* entity might not exist locally */ }
  }

  // ============================================================
  // WEBSOCKET EVENTS
  // ============================================================

  _onSyncEvents(msg) {
    if (msg.events?.length > 0) {
      this._pull().catch(console.error);
    }
  }

  /**
   * Handle server-authoritative WS events (inbox, badges, broadcast).
   * Forwards to registered listeners so main.js can notify the renderer.
   */
  _onServerEvent(eventType, data) {
    for (const cb of this._serverEventListeners) {
      try { cb(eventType, data); } catch { /* ignore */ }
    }
  }

  /**
   * Register a listener for server-authoritative events.
   * Callback receives (eventType, data).
   */
  onServerEvent(callback) {
    this._serverEventListeners.push(callback);
    return () => {
      this._serverEventListeners = this._serverEventListeners.filter((cb) => cb !== callback);
    };
  }

  // ============================================================
  // AUDIT LOG PUSH
  // ============================================================

  /**
   * Buffer an audit log entry for server push.
   * Called by logManager or IPC handlers.
   */
  enqueueAuditLog(logEntry) {
    if (this._auditLogBuffer.length >= this._auditLogMaxBuffer) {
      this._auditLogBuffer.shift(); // Drop oldest if buffer is full
    }
    this._auditLogBuffer.push({
      action: logEntry.action_type || logEntry.action || 'unknown',
      category: logEntry.category || 'system',
      severity: logEntry.severity || 'info',
      status: logEntry.status || 'success',
      target_type: logEntry.target_type || logEntry.tool_id || null,
      target_id: logEntry.target_id || null,
      details: logEntry.details || {},
    });
  }

  /**
   * Flush buffered audit logs to the server.
   */
  async _flushAuditLogs() {
    if (this._auditLogBuffer.length === 0) return;
    if (!this.tokenStore.isConnected()) return;

    const batch = this._auditLogBuffer.splice(0, this._auditLogMaxBuffer);
    try {
      const deviceId = this.tokenStore.getTokens()?.device_id || null;
      await this.apiClient.pushAuditLogs(batch, deviceId);
    } catch (err) {
      // Put logs back in front of buffer for retry
      this._auditLogBuffer.unshift(...batch);
      console.warn('Audit log push failed, will retry:', err.message);
    }
  }

  // ============================================================
  // STATUS
  // ============================================================

  getStatus() {
    return {
      status: this._status,
      connected: this.tokenStore.isConnected(),
      wsConnected: this.wsClient.isConnected(),
      pendingOps: this.syncQueue?.pendingCount() || 0,
      lastError: this._lastError,
      serverUserId: this.tokenStore.getTokens()?.server_user_id || null,
    };
  }

  onStatusChange(callback) {
    this._statusListeners.push(callback);
    return () => {
      this._statusListeners = this._statusListeners.filter((cb) => cb !== callback);
    };
  }

  _setStatus(status) {
    if (this._status === status) return;
    this._status = status;
    if (status !== 'error') this._lastError = null;
    for (const cb of this._statusListeners) {
      try { cb(this.getStatus()); } catch { /* ignore */ }
    }
  }
}

module.exports = SyncManager;
