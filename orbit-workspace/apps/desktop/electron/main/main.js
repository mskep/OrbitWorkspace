const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Import managers (non-electron dependent)
const StorageManager = require('./storage');
const DatabaseService = require('./database/DatabaseService');
const AuthService = require('./security/authServiceSQLite');
const PermissionsManager = require('./permissions');
const ToolRunner = require('./toolRunner');
const NetworkMonitor = require('./netMonitor');
const LogManager = require('./logManager');

// Electron-dependent managers will be required after app is ready
let TrayManager;
let AutoLaunch;

const SyncManager = require('./sync/SyncManager');
const { IPC_CHANNELS } = require('../shared/constants');

let mainWindow;
let trayManager;
let storage;
let dbService;
let authService;
let permissionsManager;
let toolRunner;
let networkMonitor;
let autoLaunch;
let logManager;
let syncManager;
let isDev;

app.setAppUserModelId('com.orbit.app');

// Suppress Chromium GPU/disk cache errors on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Delete corrupted Service Worker storage BEFORE Chromium initializes it
// This must run synchronously before app.whenReady()
try {
  const swPath = path.join(app.getPath('userData'), 'Service Worker');
  if (fs.existsSync(swPath)) {
    fs.rmSync(swPath, { recursive: true, force: true });
  }
} catch (_) {
  // Ignore — folder may be locked on first run, cleared next launch
}

function createWindow() {
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const icoIconPath = path.join(__dirname, '../assets/orbit-icon.ico');
  const pngIconPath = path.join(__dirname, '../assets/orbit-icon.png');
  const windowIconPath = fs.existsSync(icoIconPath) ? icoIconPath : pngIconPath;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    frame: false,
    show: false,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hidden',
    icon: windowIconPath
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = ['http://localhost:5173', 'file://'];
    if (!allowedOrigins.some((origin) => url.startsWith(origin))) {
      event.preventDefault();
    }
  });

  // Open external URLs in the system browser instead of creating new windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function emitInboxUpdate(data = null) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE, data);
  }
}

async function initializeServices() {
  const userDataPath = app.getPath('userData');

  // Initialize database service (NEW - with migration and tests)
  console.log('🗄️  Initializing database service...');
  dbService = new DatabaseService(userDataPath);
  await dbService.initialize();

  // Run health check
  const healthCheck = await dbService.healthCheck();
  console.log('💊 Database health check:', healthCheck);

  // Storage manager (still used by toolRunner for JSON-based tool configs)
  // TODO: migrate tool configs to SQLite, then remove StorageManager entirely
  storage = new StorageManager(userDataPath);
  await storage.initialize();

  // Initialize auth service with SQLite database
  authService = new AuthService(dbService, userDataPath);
  await authService.initialize();

  permissionsManager = new PermissionsManager(dbService, authService);

  // Initialize LogManager
  logManager = new LogManager(dbService.getDB());

  toolRunner = new ToolRunner(storage, permissionsManager);
  await toolRunner.initialize();

  // Network monitoring
  networkMonitor = new NetworkMonitor();
  networkMonitor.start();
  networkMonitor.addListener((isOnline) => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.SYSTEM_ONLINE_STATUS, isOnline);
    }
  });

  // Load electron-dependent modules
  AutoLaunch = require('./autoLaunch');
  autoLaunch = new AutoLaunch();

  // Initialize cloud sync manager
  syncManager = new SyncManager(dbService, authService, networkMonitor, userDataPath);
  syncManager.initialize();

  // Wire cloud services into authService (cloud-first auth)
  authService.setCloudServices(syncManager.apiClient, syncManager.tokenStore, syncManager);

  // Forward sync status changes to renderer
  syncManager.onStatusChange((status) => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.send(IPC_CHANNELS.SYNC_STATUS_CHANGED, status);
    }
  });

  // Forward server-authoritative WS events to renderer (inbox, badges, broadcasts)
  syncManager.onServerEvent((eventType, data) => {
    if (!mainWindow?.webContents) return;
    if (eventType === 'inbox_message' || eventType === 'admin_broadcast') {
      emitInboxUpdate(data);
    } else if (eventType === 'badge_update') {
      emitInboxUpdate({
        type: 'badge-assigned',
        ...(data || {}),
      });
      mainWindow.webContents.send('badge:updated', data);
    }
  });

  // Forward audit logs from logManager to syncManager for server push
  logManager.onLogCreated((logEntry) => {
    syncManager.enqueueAuditLog(logEntry);
  });

  console.log('✅ All services initialized');
}

function setupIpcHandlers() {
  // Helper: require authenticated + unlocked session
  // Returns { session } on success, or { error } if blocked
  const LOCKED_ERROR = { success: false, error: 'Session locked', code: 'CRYPTO_LOCKED' };
  async function requireUnlocked() {
    const session = await authService.getSession();
    if (!session) return { error: { success: false, error: 'Not authenticated' } };
    if (authService.getNeedsUnlock()) return { error: LOCKED_ERROR };
    return { session };
  }

  // Auth handlers - with secure logging
  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (event, { email, username, password }) => {
    try {
      const startTime = Date.now();
      const result = await authService.register(email, username, password);

      logManager.log({
        type: 'auth:register',
        userId: result.success ? result.user?.id : null,
        username: result.success ? username : null,
        status: result.success ? 'success' : 'error',
        error: result.error || null,
        duration: Date.now() - startTime,
        payload: { action: 'register' }
      });

      return result;
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, { identifier, password }) => {
    try {
      const startTime = Date.now();
      const result = await authService.login(identifier, password);

      logManager.log({
        type: 'auth:login',
        userId: result.success ? result.session?.userId : null,
        username: result.success ? result.session?.username : null,
        status: result.success ? 'success' : 'error',
        error: result.error || null,
        duration: Date.now() - startTime,
        payload: { action: 'login' }
      });

      return result;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    const session = await authService.getSession();
    const result = await authService.logout();

    // Log logout
    if (session) {
      logManager.log({
        type: 'auth:logout',
        userId: session.userId,
        username: session.username,
        status: 'success',
        payload: { action: 'logout' }
      });
    }

    return result;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    const session = await authService.getSession();
    if (!session) return null;
    return {
      ...session,
      needsUnlock: authService.getNeedsUnlock(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_UNLOCK_SESSION, async (event, { password }) => {
    try {
      const result = await authService.unlockSession(password);
      return result;
    } catch (error) {
      console.error('Unlock session error:', error);
      return { success: false, error: 'Unlock failed' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (event, { oldPassword, newPassword }) => {
    return authService.changePassword(oldPassword, newPassword);
  });

  // Profile handlers
  ipcMain.handle(IPC_CHANNELS.PROFILE_GET, async () => {
    return permissionsManager.getProfile();
  });

  ipcMain.handle(IPC_CHANNELS.PROFILE_UPDATE, async (event, updates) => {
    return permissionsManager.updateProfile(updates);
  });

  // Permissions handlers
  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_CHECK, async (event, { toolId, perms }) => {
    return permissionsManager.checkPermissions(toolId, perms);
  });

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_SET, async (event, { perm, enabled }) => {
    return permissionsManager.setPermission(perm, enabled);
  });

  // Tools handlers (auth-guarded)
  ipcMain.handle(IPC_CHANNELS.TOOLS_LIST, async () => {
    const { session, error: _authErr } = await requireUnlocked();
    if (_authErr) return [];
    return toolRunner.listTools();
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET, async (event, toolId) => {
    const { session, error: _authErr } = await requireUnlocked();
    if (_authErr) return null;
    return toolRunner.getTool(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_RUN, async (event, { toolId, action, payload }) => {
    const { session, error: _authErr } = await requireUnlocked();
    if (_authErr) return _authErr;
    return toolRunner.runTool(toolId, action, payload);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET_CONFIG, async (event, toolId) => {
    const { session, error: _authErr } = await requireUnlocked();
    if (_authErr) return {};
    return toolRunner.getToolConfig(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_SET_CONFIG, async (event, { toolId, config }) => {
    const { session, error: _authErr } = await requireUnlocked();
    if (_authErr) return _authErr;
    return toolRunner.setToolConfig(toolId, config);
  });

  // Filesystem handlers (auth-guarded)
  ipcMain.handle(IPC_CHANNELS.FS_PICK_FILE, async (event, options) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return null;

      const dialogOptions = { properties: ['openFile'] };
      if (options?.filters) dialogOptions.filters = options.filters;
      if (options?.title) dialogOptions.title = options.title;

      const result = await dialog.showOpenDialog(mainWindow, dialogOptions);
      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error('Pick file error:', error);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_PICK_FOLDER, async (event, options) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return null;

      const dialogOptions = { properties: ['openDirectory'] };
      if (options?.title) dialogOptions.title = options.title;

      const result = await dialog.showOpenDialog(mainWindow, dialogOptions);
      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error('Pick folder error:', error);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_SAVE_FILE, async (event, { defaultPath, filters }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return null;

      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters
      });
      return result.canceled ? null : result.filePath;
    } catch (error) {
      console.error('Save file dialog error:', error);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_PATH, async (event, filePath) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const errorMessage = await shell.openPath(filePath);
      if (errorMessage) {
        return { success: false, error: errorMessage };
      }
      return { success: true };
    } catch (error) {
      console.error('Open path error:', error);
      return { success: false, error: 'Failed to open path' };
    }
  });

  // System handlers — online status is always available (not auth-gated)
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_STATUS, async () => {
    let autoLaunchEnabled = false;
    try { autoLaunchEnabled = await autoLaunch.isEnabled(); } catch { /* ignore */ }
    return {
      online: networkMonitor.getStatus(),
      appVersion: app.getVersion(),
      platform: process.platform,
      autoLaunchEnabled,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SET_AUTOLAUNCH, async (event, enabled) => {
    const { session, error: _authErr } = await requireUnlocked();
    if (_authErr) return _authErr;

    const result = autoLaunch.toggle(enabled);

    // Sync settings change
    try {
      const repos = dbService.getRepositories();
      repos.userSettings.updateAutoLaunch(session.userId, enabled);
      const settings = repos.userSettings.findByUserId(session.userId);
      if (settings) {
        syncManager.enqueueChange('user_settings', session.userId, 'upsert', {
          theme: settings.theme,
          language: settings.language,
          notifications_enabled: settings.notifications_enabled,
          auto_launch_enabled: settings.auto_launch_enabled,
          active_workspace_id: settings.active_workspace_id,
          additionalSettings: settings.additionalSettings || {},
        });
      }
    } catch (err) {
      console.error('Failed to sync autolaunch setting:', err.message);
    }

    return result;
  });

  // ========================================
  // USER SETTINGS HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const settings = repos.userSettings.findByUserId(session.userId);
      if (!settings) {
        return { success: true, settings: { theme: 'dark', language: 'en', notifications_enabled: 1, auto_launch_enabled: 0, sound_enabled: 0 } };
      }
      // Extract sound_enabled from additionalSettings for easy access
      const additional = settings.additionalSettings ? (typeof settings.additionalSettings === 'string' ? JSON.parse(settings.additionalSettings) : settings.additionalSettings) : {};
      settings.sound_enabled = additional.sound_enabled ?? 0;
      return { success: true, settings };
    } catch (error) {
      console.error('Get settings error:', error);
      return { success: false, error: 'Failed to get settings' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (event, updates) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Apply updates locally
      const mappedUpdates = {};
      if (updates.theme !== undefined) mappedUpdates.theme = updates.theme;
      if (updates.language !== undefined) mappedUpdates.language = updates.language;
      if (updates.notifications_enabled !== undefined) mappedUpdates.notificationsEnabled = updates.notifications_enabled;
      else if (updates.notificationsEnabled !== undefined) mappedUpdates.notificationsEnabled = updates.notificationsEnabled;

      // Store sound_enabled in additionalSettings JSON
      if (updates.sound_enabled !== undefined) {
        const current = repos.userSettings.findByUserId(session.userId);
        const additional = current?.additionalSettings ? (typeof current.additionalSettings === 'string' ? JSON.parse(current.additionalSettings) : current.additionalSettings) : {};
        additional.sound_enabled = updates.sound_enabled;
        mappedUpdates.additionalSettings = additional;
      }

      repos.userSettings.update(session.userId, mappedUpdates);

      // Sync
      const settings = repos.userSettings.findByUserId(session.userId);
      if (settings) {
        syncManager.enqueueChange('user_settings', session.userId, 'upsert', {
          theme: settings.theme,
          language: settings.language,
          notifications_enabled: settings.notifications_enabled,
          auto_launch_enabled: settings.auto_launch_enabled,
          active_workspace_id: settings.active_workspace_id,
          additionalSettings: settings.additionalSettings || {},
        });
      }

      // Extract sound_enabled for easy access
      const additionalParsed = settings?.additionalSettings ? (typeof settings.additionalSettings === 'string' ? JSON.parse(settings.additionalSettings) : settings.additionalSettings) : {};
      if (settings) settings.sound_enabled = additionalParsed.sound_enabled ?? 0;

      return { success: true, settings };
    } catch (error) {
      console.error('Update settings error:', error);
      return { success: false, error: 'Failed to update settings' };
    }
  });

  // Logs handlers - user-specific only
  ipcMain.handle(IPC_CHANNELS.LOGS_TAIL, async (event, { type, limit }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Users can only see their own logs
      const logs = logManager.tail({
        limit: limit || 50,
        offset: 0
      }).filter(log => log.user.id === session.userId);

      return { success: true, logs };
    } catch (error) {
      console.error('Failed to get logs:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LOGS_SEARCH, async (event, query) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Force userId filter to only show user's own logs
      const logs = logManager.search({
        ...query,
        userId: session.userId // Force this regardless of what frontend sends
      });

      return { success: true, logs };
    } catch (error) {
      console.error('Failed to search logs:', error);
      return { success: false, error: error.message };
    }
  });

  // Window controls
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  // ========================================
  // WORKSPACE HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ALL, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const workspaces = repos.workspaces.findByUserId(session.userId);
      return { success: true, workspaces };
    } catch (error) {
      console.error('Get workspaces error:', error);
      return { success: false, error: 'Failed to get workspaces' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ACTIVE, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const settings = repos.userSettings.findByUserId(session.userId);
      const userWorkspaces = repos.workspaces.findByUserId(session.userId);
      const fallbackWorkspace = Array.isArray(userWorkspaces) ? userWorkspaces[0] : null;

      // No settings row yet: restore a sane default if any workspace exists.
      if (!settings) {
        if (!fallbackWorkspace) {
          return { success: false, error: 'No active workspace' };
        }

        repos.userSettings.create(session.userId, fallbackWorkspace.id);
        return { success: true, workspace: fallbackWorkspace };
      }

      if (settings.active_workspace_id) {
        const activeWorkspace = repos.workspaces.findById(settings.active_workspace_id);
        if (activeWorkspace) {
          return { success: true, workspace: activeWorkspace };
        }
      }

      // Active workspace pointer is stale or missing: fallback to first owned workspace.
      if (fallbackWorkspace) {
        repos.userSettings.updateActiveWorkspace(session.userId, fallbackWorkspace.id);
        return { success: true, workspace: fallbackWorkspace };
      }

      return { success: false, error: 'No active workspace' };
    } catch (error) {
      console.error('Get active workspace error:', error);
      return { success: false, error: 'Failed to get active workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE, async (event, { name }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const workspace = repos.workspaces.create(session.userId, name);

      syncManager.enqueueChange('workspace', workspace.id, 'upsert', {
        name: workspace.name, tools: [],
      });

      return { success: true, workspace };
    } catch (error) {
      console.error('Create workspace error:', error);
      return { success: false, error: 'Failed to create workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_UPDATE, async (event, { id, name }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(id, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.updateName(id, name);
      const workspace = repos.workspaces.findWithTools(id);

      syncManager.enqueueChange('workspace', id, 'upsert', {
        name: workspace.name,
        tools: workspace.tools || [],
      });

      return { success: true, workspace };
    } catch (error) {
      console.error('Update workspace error:', error);
      return { success: false, error: 'Failed to update workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(id, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      // Enqueue delete for all child entities BEFORE cascade-deleting them locally.
      // Without this, the server keeps the child blobs alive and they come back on next pull.
      const notes = repos.notes.findByWorkspace(id);
      for (const n of notes) syncManager.enqueueChange('note', n.id, 'delete');

      const links = repos.links.findByWorkspace(id);
      for (const l of links) syncManager.enqueueChange('link', l.id, 'delete');

      const fileRefs = repos.fileReferences?.findByWorkspace(id) || [];
      for (const f of fileRefs) syncManager.enqueueChange('file_ref', f.id, 'delete');

      const vaultItems = repos.vault?.findByWorkspace(id, { includeArchived: true }) || [];
      for (const item of vaultItems) syncManager.enqueueChange('vault_item', item.id, 'delete');

      repos.workspaces.delete(id);
      syncManager.enqueueChange('workspace', id, 'delete');
      return { success: true };
    } catch (error) {
      console.error('Delete workspace error:', error);
      return { success: false, error: 'Failed to delete workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SWITCH, async (event, { workspaceId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.userSettings.updateActiveWorkspace(session.userId, workspaceId);
      const workspace = repos.workspaces.findById(workspaceId);

      // Sync settings change
      const settings = repos.userSettings.findByUserId(session.userId);
      if (settings) {
        syncManager.enqueueChange('user_settings', session.userId, 'upsert', {
          theme: settings.theme,
          language: settings.language,
          notifications_enabled: settings.notifications_enabled,
          auto_launch_enabled: settings.auto_launch_enabled,
          active_workspace_id: settings.active_workspace_id,
          additionalSettings: settings.additionalSettings || {},
        });
      }

      return { success: true, workspace };
    } catch (error) {
      console.error('Switch workspace error:', error);
      return { success: false, error: 'Failed to switch workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_TOOLS, async (event, { workspaceId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const tools = repos.workspaces.getTools(workspaceId);
      return { success: true, tools };
    } catch (error) {
      console.error('Get workspace tools error:', error);
      return { success: false, error: 'Failed to get workspace tools' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ADD_TOOL, async (event, { workspaceId, toolId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.addTool(workspaceId, toolId);

      const wsWithTools = repos.workspaces.findWithTools(workspaceId);
      syncManager.enqueueChange('workspace', workspaceId, 'upsert', {
        name: wsWithTools.name,
        tools: wsWithTools.tools || [],
      });

      return { success: true };
    } catch (error) {
      console.error('Add workspace tool error:', error);
      return { success: false, error: 'Failed to add tool' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE_TOOL, async (event, { workspaceId, toolId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.removeTool(workspaceId, toolId);

      const wsWithTools = repos.workspaces.findWithTools(workspaceId);
      syncManager.enqueueChange('workspace', workspaceId, 'upsert', {
        name: wsWithTools.name,
        tools: wsWithTools.tools || [],
      });

      return { success: true };
    } catch (error) {
      console.error('Remove workspace tool error:', error);
      return { success: false, error: 'Failed to remove tool' };
    }
  });

  // ========================================
  // NOTES HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.NOTE_GET_ALL, async (event, { workspaceId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const notes = repos.notes.findByWorkspace(workspaceId);
      return { success: true, notes };
    } catch (error) {
      console.error('Get notes error:', error);
      return { success: false, error: 'Failed to get notes' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_GET, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      return { success: true, note };
    } catch (error) {
      console.error('Get note error:', error);
      return { success: false, error: 'Failed to get note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_CREATE, async (event, { workspaceId, title, content, tags, isPinned }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const note = repos.notes.create({
        workspaceId,
        userId: session.userId,
        title,
        content,
        tags: tags || '',
        isPinned: isPinned || false
      });

      syncManager.enqueueChange('note', note.id, 'upsert', {
        title: note.title, content: note.content, tags: note.tags,
        is_pinned: note.is_pinned, workspace_id: workspaceId,
      });

      return { success: true, note };
    } catch (error) {
      console.error('Create note error:', error);
      return { success: false, error: 'Failed to create note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_UPDATE, async (event, { id, title, content, tags }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      repos.notes.update(id, { title, content, tags });
      const updated = repos.notes.findById(id);

      syncManager.enqueueChange('note', id, 'upsert', {
        title: updated.title, content: updated.content, tags: updated.tags,
        is_pinned: updated.is_pinned, workspace_id: updated.workspace_id,
      });

      return { success: true, note: updated };
    } catch (error) {
      console.error('Update note error:', error);
      return { success: false, error: 'Failed to update note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_DELETE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      repos.notes.delete(id);
      syncManager.enqueueChange('note', id, 'delete');
      return { success: true };
    } catch (error) {
      console.error('Delete note error:', error);
      return { success: false, error: 'Failed to delete note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_SEARCH, async (event, { workspaceId, query }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const notes = repos.notes.search(workspaceId, query);
      return { success: true, notes };
    } catch (error) {
      console.error('Search notes error:', error);
      return { success: false, error: 'Failed to search notes' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_TOGGLE_PIN, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      repos.notes.togglePin(id);
      const updated = repos.notes.findById(id);

      syncManager.enqueueChange('note', id, 'upsert', {
        title: updated.title, content: updated.content, tags: updated.tags,
        is_pinned: updated.is_pinned, workspace_id: updated.workspace_id,
      });

      return { success: true, note: updated };
    } catch (error) {
      console.error('Toggle pin note error:', error);
      return { success: false, error: 'Failed to toggle pin' };
    }
  });

  // ========================================
  // LINKS HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.LINK_GET_ALL, async (event, { workspaceId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const links = repos.links.findByWorkspace(workspaceId);
      return { success: true, links };
    } catch (error) {
      console.error('Get links error:', error);
      return { success: false, error: 'Failed to get links' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_GET, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      return { success: true, link };
    } catch (error) {
      console.error('Get link error:', error);
      return { success: false, error: 'Failed to get link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_CREATE, async (event, { workspaceId, title, url, description, tags, isFavorite }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const link = repos.links.create({
        workspaceId,
        userId: session.userId,
        title,
        url,
        description: description || '',
        tags: tags || '',
        isFavorite: isFavorite || false
      });

      syncManager.enqueueChange('link', link.id, 'upsert', {
        title: link.title, url: link.url, description: link.description,
        tags: link.tags, is_favorite: link.is_favorite,
        favicon_url: link.favicon_url, workspace_id: workspaceId,
      });

      return { success: true, link };
    } catch (error) {
      console.error('Create link error:', error);
      return { success: false, error: 'Failed to create link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_UPDATE, async (event, { id, title, url, description, tags }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      repos.links.update(id, { title, url, description, tags });
      const updated = repos.links.findById(id);

      syncManager.enqueueChange('link', id, 'upsert', {
        title: updated.title, url: updated.url, description: updated.description,
        tags: updated.tags, is_favorite: updated.is_favorite,
        favicon_url: updated.favicon_url, workspace_id: updated.workspace_id,
      });

      return { success: true, link: updated };
    } catch (error) {
      console.error('Update link error:', error);
      return { success: false, error: 'Failed to update link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_DELETE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      repos.links.delete(id);
      syncManager.enqueueChange('link', id, 'delete');
      return { success: true };
    } catch (error) {
      console.error('Delete link error:', error);
      return { success: false, error: 'Failed to delete link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_SEARCH, async (event, { workspaceId, query }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const links = repos.links.search(workspaceId, query);
      return { success: true, links };
    } catch (error) {
      console.error('Search links error:', error);
      return { success: false, error: 'Failed to search links' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_TOGGLE_FAVORITE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      repos.links.toggleFavorite(id);
      const updated = repos.links.findById(id);

      syncManager.enqueueChange('link', id, 'upsert', {
        title: updated.title, url: updated.url, description: updated.description,
        tags: updated.tags, is_favorite: updated.is_favorite,
        favicon_url: updated.favicon_url, workspace_id: updated.workspace_id,
      });

      return { success: true, link: updated };
    } catch (error) {
      console.error('Toggle favorite link error:', error);
      return { success: false, error: 'Failed to toggle favorite' };
    }
  });

  // ========================================
  // FILE REFERENCES HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.FILE_REF_GET_ALL, async (event, { workspaceId }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const fileRefs = repos.fileReferences.findByWorkspace(workspaceId);
      return { success: true, fileRefs };
    } catch (error) {
      console.error('Get file references error:', error);
      return { success: false, error: 'Failed to get file references' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_GET, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      return { success: true, file: fileRef };
    } catch (error) {
      console.error('Get file reference error:', error);
      return { success: false, error: 'Failed to get file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_CREATE, async (event, { workspaceId, name, path, type, description, tags, isPinned }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const fileRef = repos.fileReferences.create({
        workspaceId,
        userId: session.userId,
        name,
        path,
        type,
        description: description || '',
        tags: tags || '',
        isPinned: isPinned || false
      });

      syncManager.enqueueChange('file_ref', fileRef.id, 'upsert', {
        name: fileRef.name, path, type: fileRef.type,
        description: fileRef.description, tags: fileRef.tags,
        is_pinned: fileRef.is_pinned, workspace_id: workspaceId,
      });

      return { success: true, file: fileRef };
    } catch (error) {
      console.error('Create file reference error:', error);
      return { success: false, error: 'Failed to create file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_UPDATE, async (event, { id, name, path, description, tags }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      repos.fileReferences.update(id, { name, path, description, tags });
      const updated = repos.fileReferences.findById(id);

      syncManager.enqueueChange('file_ref', id, 'upsert', {
        name: updated.name, path: updated.path,
        type: updated.type, description: updated.description,
        tags: updated.tags, is_pinned: updated.is_pinned,
        workspace_id: updated.workspace_id,
      });

      return { success: true, file: updated };
    } catch (error) {
      console.error('Update file reference error:', error);
      return { success: false, error: 'Failed to update file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_DELETE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      repos.fileReferences.delete(id);
      syncManager.enqueueChange('file_ref', id, 'delete');
      return { success: true };
    } catch (error) {
      console.error('Delete file reference error:', error);
      return { success: false, error: 'Failed to delete file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_SEARCH, async (event, { workspaceId, query }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();

      // Check workspace ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const files = repos.fileReferences.search(workspaceId, query);
      return { success: true, files };
    } catch (error) {
      console.error('Search file references error:', error);
      return { success: false, error: 'Failed to search file references' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_OPEN, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      // Update last accessed
      repos.fileReferences.updateLastAccessed(id);

      // Open with shell
      await shell.openPath(fileRef.path);

      return { success: true };
    } catch (error) {
      console.error('Open file reference error:', error);
      return { success: false, error: 'Failed to open file' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_SHOW_IN_FOLDER, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      // Show in folder/explorer
      shell.showItemInFolder(fileRef.path);

      return { success: true };
    } catch (error) {
      console.error('Show in folder error:', error);
      return { success: false, error: 'Failed to show in folder' };
    }
  });

  // ========================================
  // SECRET VAULT HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.VAULT_GET_ALL, async (event, payload = {}) => {
    try {
      const { workspaceId, includeArchived = false, type = 'all' } = payload;
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (!workspaceId) {
        return { success: false, error: 'workspaceId is required' };
      }

      const repos = dbService.getRepositories();
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const normalizedType = typeof type === 'string' && type !== 'all' ? type : null;
      const items = repos.vault.findByWorkspace(workspaceId, {
        includeArchived: !!includeArchived,
        type: normalizedType,
      });

      return { success: true, items };
    } catch (error) {
      console.error('Get vault items error:', error);
      return { success: false, error: 'Failed to get vault items' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_GET, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      const item = repos.vault.findById(id);
      if (!item || item.user_id !== session.userId) {
        return { success: false, error: 'Vault item not found' };
      }

      return { success: true, item };
    } catch (error) {
      console.error('Get vault item error:', error);
      return { success: false, error: 'Failed to get vault item' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_CREATE, async (event, payload = {}) => {
    try {
      const {
        workspaceId,
        title,
        type = 'password',
        secret = '',
        username = '',
        website = '',
        note = '',
        tags = '',
        isPinned = false,
      } = payload;

      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (!workspaceId || !title || !title.trim()) {
        return { success: false, error: 'workspaceId and title are required' };
      }

      const repos = dbService.getRepositories();
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const item = repos.vault.create({
        workspaceId,
        userId: session.userId,
        title: title.trim(),
        type,
        secret,
        username,
        website,
        note,
        tags: tags || '',
        isArchived: false,
        isPinned: !!isPinned,
      });

      syncManager.enqueueChange('vault_item', item.id, 'upsert', {
        workspace_id: item.workspace_id,
        title: item.title,
        type: item.type,
        secret: item.secret,
        username: item.username,
        website: item.website,
        note: item.note,
        tags: item.tags,
        is_archived: item.is_archived,
        is_pinned: item.is_pinned,
      });

      return { success: true, item };
    } catch (error) {
      console.error('Create vault item error:', error);
      return { success: false, error: 'Failed to create vault item' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_UPDATE, async (event, payload = {}) => {
    try {
      const {
        id,
        title,
        type,
        secret,
        username,
        website,
        note,
        tags,
        isArchived,
        isPinned,
      } = payload;

      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      if (!repos.vault.isOwner(id, session.userId)) {
        return { success: false, error: 'Vault item not found' };
      }

      const updatePatch = {};
      if (title !== undefined) updatePatch.title = title;
      if (type !== undefined) updatePatch.type = type;
      if (secret !== undefined) updatePatch.secret = secret;
      if (username !== undefined) updatePatch.username = username;
      if (website !== undefined) updatePatch.website = website;
      if (note !== undefined) updatePatch.note = note;
      if (tags !== undefined) updatePatch.tags = tags;
      if (isArchived !== undefined) updatePatch.isArchived = !!isArchived;
      if (isPinned !== undefined) updatePatch.isPinned = !!isPinned;

      const item = repos.vault.update(id, updatePatch);
      if (!item) {
        return { success: false, error: 'Vault item not found' };
      }

      syncManager.enqueueChange('vault_item', item.id, 'upsert', {
        workspace_id: item.workspace_id,
        title: item.title,
        type: item.type,
        secret: item.secret,
        username: item.username,
        website: item.website,
        note: item.note,
        tags: item.tags,
        is_archived: item.is_archived,
        is_pinned: item.is_pinned,
      });

      return { success: true, item };
    } catch (error) {
      console.error('Update vault item error:', error);
      return { success: false, error: 'Failed to update vault item' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_TOGGLE_ARCHIVED, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      if (!repos.vault.isOwner(id, session.userId)) {
        return { success: false, error: 'Vault item not found' };
      }

      const item = repos.vault.toggleArchived(id);
      syncManager.enqueueChange('vault_item', item.id, 'upsert', {
        workspace_id: item.workspace_id,
        title: item.title,
        type: item.type,
        secret: item.secret,
        username: item.username,
        website: item.website,
        note: item.note,
        tags: item.tags,
        is_archived: item.is_archived,
        is_pinned: item.is_pinned,
      });

      return { success: true, item };
    } catch (error) {
      console.error('Toggle vault archive error:', error);
      return { success: false, error: 'Failed to update vault archive state' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_TOGGLE_PIN, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      if (!repos.vault.isOwner(id, session.userId)) {
        return { success: false, error: 'Vault item not found' };
      }

      const item = repos.vault.togglePinned(id);
      if (!item) {
        return { success: false, error: 'Vault item not found' };
      }

      syncManager.enqueueChange('vault_item', item.id, 'upsert', {
        workspace_id: item.workspace_id,
        title: item.title,
        type: item.type,
        secret: item.secret,
        username: item.username,
        website: item.website,
        note: item.note,
        tags: item.tags,
        is_archived: item.is_archived,
        is_pinned: item.is_pinned,
      });

      return { success: true, item };
    } catch (error) {
      console.error('Toggle vault pin error:', error);
      return { success: false, error: 'Failed to update vault pin state' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_DELETE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      const repos = dbService.getRepositories();
      if (!repos.vault.isOwner(id, session.userId)) {
        return { success: false, error: 'Vault item not found' };
      }

      repos.vault.delete(id);
      syncManager.enqueueChange('vault_item', id, 'delete');
      return { success: true };
    } catch (error) {
      console.error('Delete vault item error:', error);
      return { success: false, error: 'Failed to delete vault item' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.VAULT_SEARCH, async (event, payload = {}) => {
    try {
      const { workspaceId, query = '', includeArchived = false, type = 'all' } = payload;
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (!workspaceId) {
        return { success: false, error: 'workspaceId is required' };
      }

      const repos = dbService.getRepositories();
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      const normalizedType = typeof type === 'string' && type !== 'all' ? type : null;
      const items = repos.vault.search(workspaceId, query, {
        includeArchived: !!includeArchived,
        type: normalizedType,
      });

      return { success: true, items };
    } catch (error) {
      console.error('Search vault items error:', error);
      return { success: false, error: 'Failed to search vault items' };
    }
  });

  // ========================================
  // BADGES HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.BADGE_GET_ALL, async () => {
    try {
      // When connected, fetch from server (source of truth)
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getBadges();
          return { success: true, badges: result.badges };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      const badges = repos.badges.findAll();
      return { success: true, badges };
    } catch (error) {
      console.error('Get badges error:', error);
      return { success: false, error: 'Failed to get badges' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BADGE_GET_USER_BADGES, async (event, payload = {}) => {
    try {
      const { userId } = payload;
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Users can only get their own badges unless they're admin/dev
      if (userId && userId !== session.userId && session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      const targetUserId = userId || session.userId;

      // When connected, server is source of truth
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = targetUserId === session.userId
            ? await syncManager.apiClient.getMyBadges()
            : await syncManager.apiClient.getUserBadges(targetUserId);
          return { success: true, badges: result.badges };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      const badges = repos.badges.findByUserId(targetUserId);
      return { success: true, badges };
    } catch (error) {
      console.error('Get user badges error:', error);
      return { success: false, error: 'Failed to get user badges' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BADGE_ASSIGN, async (event, payload = {}) => {
    try {
      const { userId, badgeId } = payload;
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      if (!userId || !badgeId) {
        return { success: false, error: 'Missing badge assignment parameters' };
      }

      // When connected, server handles everything (assign + inbox notification + WS)
      if (syncManager.tokenStore.isConnected()) {
        try {
          await syncManager.apiClient.assignBadge(userId, badgeId);
          if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message || 'Server badge assign failed' };
        }
      }

      // Offline fallback: local-only
      const repos = dbService.getRepositories();

      const badge = repos.badges.findAll().find((b) => b.id === badgeId);
      if (!badge) return { success: false, error: 'Badge not found' };

      repos.badges.assign(userId, badgeId, session.userId);
      repos.inbox.createBadgeAssignedMessage(userId, badge.display_name, session.username);
      if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);

      return { success: true };
    } catch (error) {
      console.error('Assign badge error:', error);
      return { success: false, error: error.message || 'Failed to assign badge' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BADGE_REVOKE, async (event, payload = {}) => {
    try {
      const { userId, badgeId } = payload;
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      if (!userId || !badgeId) {
        return { success: false, error: 'Missing badge revoke parameters' };
      }

      // When connected, server handles everything
      if (syncManager.tokenStore.isConnected()) {
        try {
          await syncManager.apiClient.revokeBadge(userId, badgeId);
          if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message || 'Server badge revoke failed' };
        }
      }

      // Offline fallback
      const repos = dbService.getRepositories();

      const badge = repos.badges.findAll().find((b) => b.id === badgeId);
      if (!badge) return { success: false, error: 'Badge not found' };

      repos.badges.revoke(userId, badgeId);
      repos.inbox.createBadgeRevokedMessage(userId, badge.display_name, session.username);
      if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);

      return { success: true };
    } catch (error) {
      console.error('Revoke badge error:', error);
      return { success: false, error: error.message || 'Failed to revoke badge' };
    }
  });

  // ========================================
  // INBOX HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.INBOX_GET_ALL, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // When connected, server is source of truth
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getInboxMessages();
          return { success: true, messages: result.messages };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      const messages = repos.inbox.findByUserId(session.userId);
      return { success: true, messages };
    } catch (error) {
      console.error('Get inbox error:', error);
      return { success: false, error: 'Failed to get inbox messages' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INBOX_GET_UNREAD_COUNT, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getInboxUnreadCount();
          return { success: true, count: result.count };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      const count = repos.inbox.countUnread(session.userId);
      return { success: true, count };
    } catch (error) {
      console.error('Get unread count error:', error);
      return { success: false, error: 'Failed to get unread count' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INBOX_MARK_READ, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Server first when connected
      if (syncManager.tokenStore.isConnected()) {
        try {
          await syncManager.apiClient.markInboxRead(id);
          // Also update local cache
          try {
            const repos = dbService.getRepositories();
            repos.inbox.markAsRead(id);
          } catch { /* local cache miss is fine */ }
          return { success: true };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      const message = repos.inbox.findById(id);
      if (!message || message.user_id !== session.userId) {
        return { success: false, error: 'Message not found' };
      }
      repos.inbox.markAsRead(id);
      return { success: true };
    } catch (error) {
      console.error('Mark read error:', error);
      return { success: false, error: 'Failed to mark as read' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INBOX_MARK_ALL_READ, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (syncManager.tokenStore.isConnected()) {
        try {
          await syncManager.apiClient.markInboxAllRead();
          try {
            const repos = dbService.getRepositories();
            repos.inbox.markAllAsRead(session.userId);
          } catch { /* local cache miss is fine */ }
          return { success: true };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      repos.inbox.markAllAsRead(session.userId);
      return { success: true };
    } catch (error) {
      console.error('Mark all read error:', error);
      return { success: false, error: 'Failed to mark all as read' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INBOX_DELETE, async (event, { id }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (syncManager.tokenStore.isConnected()) {
        try {
          await syncManager.apiClient.deleteInboxMessage(id);
          try {
            const repos = dbService.getRepositories();
            repos.inbox.delete(id);
          } catch { /* local cache miss is fine */ }
          return { success: true };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      const message = repos.inbox.findById(id);
      if (!message || message.user_id !== session.userId) {
        return { success: false, error: 'Message not found' };
      }
      repos.inbox.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Delete message error:', error);
      return { success: false, error: 'Failed to delete message' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INBOX_DELETE_READ, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (syncManager.tokenStore.isConnected()) {
        try {
          await syncManager.apiClient.deleteInboxReadMessages();
          try {
            const repos = dbService.getRepositories();
            repos.inbox.deleteAllRead(session.userId);
          } catch { /* local cache miss is fine */ }
          return { success: true };
        } catch { /* fall through to local */ }
      }

      const repos = dbService.getRepositories();
      repos.inbox.deleteAllRead(session.userId);
      return { success: true };
    } catch (error) {
      console.error('Delete read messages error:', error);
      return { success: false, error: 'Failed to delete read messages' };
    }
  });

  // ========================================
  // ADMIN HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.ADMIN_GET_STATS, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Only admins and devs can view stats
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      // Route through server when connected (server = source of truth for stats)
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getAdminStats();
          return { success: true, stats: result.stats || result };
        } catch (err) {
          console.warn('Admin getStats from server failed, falling back to local:', err.message);
        }
      }

      // Offline fallback: local SQLite counts
      const repos = dbService.getRepositories();
      const db = dbService.getDB();

      const countTable = (table) => db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;

      const stats = {
        totalUsers: repos.users.count(),
        activeUsers: repos.users.countActive(30),
        disabledUsers: repos.users.countDisabled(),
        usersPerMonth: repos.users.getUsersPerMonth(12),
        totalWorkspaces: countTable('workspaces'),
        totalNotes: countTable('notes'),
        totalLinks: countTable('links'),
        totalFileRefs: countTable('file_references'),
        totalVaultItems: countTable('vault_items'),
        activeTools: countTable('workspace_tools'),
        totalBadges: countTable('badges'),
        totalInboxItems: countTable('inbox_messages')
      };

      return { success: true, stats };
    } catch (error) {
      console.error('Get admin stats error:', error);
      return { success: false, error: 'Failed to get stats' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_GET_USERS, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Only admins and devs can view all users
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      // Route through server API when connected (server is authority for user list)
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getUsers();
          return { success: true, users: result.users || result };
        } catch (err) {
          console.warn('Admin getUsers from server failed, falling back to local:', err.message);
        }
      }

      // Fallback to local SQLite (offline mode)
      const repos = dbService.getRepositories();
      const users = repos.users.findAll();

      return { success: true, users };
    } catch (error) {
      console.error('Get users error:', error);
      return { success: false, error: 'Failed to get users' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_GET_AUDIT_LOGS, async (event, query = {}) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Only admins and devs can view audit logs
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      // Route through server when connected (server has all users' logs)
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getAdminAuditLogs(query);
          // Normalize server flat rows to nested format expected by AdminPanel UI
          const normalizedLogs = (result.logs || []).map((row) => ({
            id: row.id,
            uuid: row.id?.toString(),
            timestamp: row.created_at ? new Date(row.created_at).getTime() : 0,
            duration: null,
            user: { id: row.user_id, username: row.username || 'system', role: null, roleLevel: null },
            action: { type: row.action || 'unknown', name: null, tool: { id: null, name: row.target_type || null } },
            status: row.status || 'success',
            error: null,
            meta: { severity: row.severity || 'info', category: row.category || 'system' },
          }));
          const summary = normalizedLogs.reduce(
            (acc, log) => {
              acc.total += 1;
              acc.byStatus[log.status] = (acc.byStatus[log.status] || 0) + 1;
              acc.bySeverity[log.meta.severity] = (acc.bySeverity[log.meta.severity] || 0) + 1;
              acc.byCategory[log.meta.category] = (acc.byCategory[log.meta.category] || 0) + 1;
              return acc;
            },
            { total: 0, byStatus: {}, bySeverity: {}, byCategory: {} }
          );
          return { success: true, logs: normalizedLogs, summary };
        } catch (err) {
          console.warn('Admin getAuditLogs from server failed, falling back to local:', err.message);
        }
      }

      // Offline fallback: local logManager
      const sanitizeText = (value, maxLen = 120) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed ? trimmed.slice(0, maxLen) : null;
      };

      const rawLimit = Number(query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 20), 500) : 200;

      const filters = { limit };

      const search = sanitizeText(query.search, 200);
      if (search) filters.search = search;

      const type = sanitizeText(query.type, 120);
      if (type) filters.type = type;

      const status = sanitizeText(query.status, 24);
      if (status) filters.status = status;

      const category = sanitizeText(query.category, 32);
      if (category) filters.category = category;

      const severity = sanitizeText(query.severity, 16);
      if (severity) filters.severity = severity;

      const userId = sanitizeText(query.userId, 80);
      if (userId) filters.userId = userId;

      const toolId = sanitizeText(query.toolId, 80);
      if (toolId) filters.toolId = toolId;

      const startDate = Number(query.startDate);
      if (Number.isFinite(startDate) && startDate > 0) {
        filters.startDate = Math.floor(startDate);
      }

      const endDate = Number(query.endDate);
      if (Number.isFinite(endDate) && endDate > 0) {
        filters.endDate = Math.floor(endDate);
      }

      const logs = logManager.search(filters);
      const summary = logs.reduce(
        (acc, log) => {
          acc.total += 1;
          acc.byStatus[log.status] = (acc.byStatus[log.status] || 0) + 1;
          acc.bySeverity[log.meta.severity] = (acc.bySeverity[log.meta.severity] || 0) + 1;
          acc.byCategory[log.meta.category] = (acc.byCategory[log.meta.category] || 0) + 1;
          return acc;
        },
        { total: 0, byStatus: {}, bySeverity: {}, byCategory: {} }
      );

      return { success: true, logs, summary };
    } catch (error) {
      console.error('Get audit logs error:', error);
      return { success: false, error: 'Failed to get audit logs' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_UPDATE_USER_ROLE, async (event, { userId, role }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Only admins can update roles
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const validRoles = new Set(['USER', 'PREMIUM', 'DEV', 'ADMIN']);
      if (!userId || !validRoles.has(role)) {
        return { success: false, error: 'Invalid role update payload' };
      }

      // Prevent self-demotion
      if (userId === session.userId && role !== 'ADMIN') {
        return { success: false, error: 'Cannot change your own role' };
      }

      const repos = dbService.getRepositories();

      // Route through server when connected (server handles all safeguards)
      if (syncManager.tokenStore.isConnected()) {
        await syncManager.apiClient.updateUserRole(userId, role);
        // Update local cache if user exists locally
        const localUser = repos.users.findById(userId);
        if (localUser) {
          repos.users.updateRole(userId, role);
        }
        // Inbox notification is server-authoritative when connected
        return { success: true };
      }

      // Offline fallback: local-only
      const user = repos.users.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Prevent removing the last admin (local check)
      if (user.role === 'ADMIN' && role !== 'ADMIN') {
        const allUsers = repos.users.findAll();
        const adminCount = allUsers.filter((u) => u.role === 'ADMIN' && u.status === 'active').length;
        if (adminCount <= 1) {
          return { success: false, error: 'Cannot demote the last admin' };
        }
      }

      const oldRole = user.role;
      repos.users.updateRole(userId, role);

      // Create inbox notification
      repos.inbox.createRoleChangedMessage(userId, oldRole, role, session.username);
      if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);

      return { success: true };
    } catch (error) {
      console.error('Update user role error:', error);
      return { success: false, error: error.message || 'Failed to update user role' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_UPDATE_USER_STATUS, async (event, { userId, status }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      // Only admins can update status
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const validStatuses = new Set(['active', 'disabled']);
      if (!userId || !validStatuses.has(status)) {
        return { success: false, error: 'Invalid status update payload' };
      }

      // Prevent self-disable
      if (userId === session.userId) {
        return { success: false, error: 'Cannot change your own status' };
      }

      const repos = dbService.getRepositories();

      // Route through server when connected (server handles all safeguards)
      if (syncManager.tokenStore.isConnected()) {
        await syncManager.apiClient.updateUserStatus(userId, status);
        // Update local cache if user exists locally
        const localUser = repos.users.findById(userId);
        if (localUser) repos.users.updateStatus(userId, status);
        return { success: true };
      }

      // Offline fallback: local-only
      const user = repos.users.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Prevent disabling the last active admin (local check)
      if (user.role === 'ADMIN' && status !== 'active') {
        const allUsers = repos.users.findAll();
        const activeAdminCount = allUsers.filter((u) => u.role === 'ADMIN' && u.status === 'active').length;
        if (activeAdminCount <= 1) {
          return { success: false, error: 'Cannot disable the last active admin' };
        }
      }

      repos.users.updateStatus(userId, status);

      return { success: true };
    } catch (error) {
      console.error('Update user status error:', error);
      return { success: false, error: error.message || 'Failed to update user status' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_SEND_NOTIFICATION, async (event, { title, message, target, userId, category }) => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      if (!title || !message) {
        return { success: false, error: 'Title and message are required' };
      }

      const broadcastCategory = category || 'admin-broadcast';

      // When connected, server handles broadcast + inbox creation + WS notification
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.sendInboxBroadcast({
            title, message, target: target || 'all', userId, category: broadcastCategory,
          });
          if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);
          return { success: true, sent: result.sent };
        } catch (err) {
          return { success: false, error: err.message || 'Server broadcast failed' };
        }
      }

      // Offline fallback: local only
      const repos = dbService.getRepositories();
      const senderUsername = session.username;

      if (target === 'all') {
        const allUsers = repos.users.findAll();
        const results = repos.inbox.broadcastToUsers(
          allUsers.map((u) => u.id),
          title, message, senderUsername, broadcastCategory
        );
        if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);
        return { success: true, sent: results.length };
      } else if (target === 'user' && userId) {
        repos.inbox.createBroadcastMessage(userId, title, message, senderUsername, broadcastCategory);
        if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);
        return { success: true, sent: 1 };
      } else {
        return { success: false, error: 'Invalid target' };
      }
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_GET_BROADCAST_HISTORY, async () => {
    try {
      const { session, error: _authErr } = await requireUnlocked();
      if (_authErr) return _authErr;

      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      // Connected mode: server is authoritative and can return global broadcast history
      if (syncManager.tokenStore.isConnected()) {
        try {
          const result = await syncManager.apiClient.getInboxBroadcastHistory(100);
          return { success: true, history: result.history || [] };
        } catch (err) {
          console.warn('Admin getBroadcastHistory from server failed, falling back to local:', err.message);
        }
      }

      const repos = dbService.getRepositories();
      const history = repos.inbox.getBroadcastHistory();
      return { success: true, history };
    } catch (error) {
      console.error('Get broadcast history error:', error);
      return { success: false, error: 'Failed to get broadcast history' };
    }
  });

  // ============================================================
  // RECOVERY / CRYPTO
  // ============================================================

  ipcMain.handle(IPC_CHANNELS.CRYPTO_SAVE_RECOVERY_FILE, async (event, { content, username }) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Recovery Key',
        defaultPath: `orbit-recovery-${username}.txt`,
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
      });

      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled' };
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Save recovery file error:', error);
      return { success: false, error: 'Failed to save recovery file' };
    }
  });

  // Pick recovery file — no auth guard (used on login page)
  ipcMain.handle(IPC_CHANNELS.CRYPTO_PICK_RECOVERY_FILE, async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Recovery Key File',
        filters: [{ name: 'Recovery Files', extensions: ['txt'] }],
        properties: ['openFile'],
      });
      if (canceled || !filePaths.length) return null;
      return { filePath: filePaths[0], fileName: require('path').basename(filePaths[0]) };
    } catch (error) {
      console.error('Pick recovery file error:', error);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CRYPTO_RECOVER_WITH_FILE, async (event, { newPassword, filePath }) => {
    try {
      let recoveryFilePath = filePath;

      // Fallback: open file picker if no filePath provided
      if (!recoveryFilePath) {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Select Recovery Key File',
          filters: [{ name: 'Recovery Files', extensions: ['txt'] }],
          properties: ['openFile'],
        });
        if (canceled || !filePaths.length) {
          return { success: false, error: 'Cancelled' };
        }
        recoveryFilePath = filePaths[0];
      }

      const fileContent = fs.readFileSync(recoveryFilePath, 'utf-8');
      const result = await authService.recoverWithFile(fileContent, newPassword);
      return result;
    } catch (error) {
      console.error('Recovery error:', error);
      return { success: false, error: 'Recovery failed' };
    }
  });

  // ========================================
  // CLOUD SYNC HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, async () => {
    return syncManager.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_CLOUD_DISCONNECT, async () => {
    try {
      // Disconnect = full logout (stops sync, clears tokens, locks crypto)
      const result = await authService.logout();
      return result;
    } catch (error) {
      console.error('Cloud disconnect error:', error);
      return { success: false, error: error.message || 'Disconnect failed' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_FORCE_PUSH, async () => {
    try {
      await syncManager._push();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_FORCE_PULL, async () => {
    try {
      await syncManager._pull();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_DEVICES, async () => {
    try {
      const response = await syncManager.apiClient.getDevices();
      const devices = Array.isArray(response?.devices) ? response.devices : [];
      return { success: true, devices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_DELETE_DEVICE, async (event, { deviceId }) => {
    try {
      await syncManager.apiClient.deleteDevice(deviceId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(async () => {
  await initializeServices();

  // Try to restore session
  await authService.restoreSession();

  createWindow();

  // Create tray (load TrayManager after app is ready)
  TrayManager = require('./tray');
  trayManager = new TrayManager(mainWindow);
  trayManager.create();

  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit on window close on Windows (tray behavior)
  if (process.platform !== 'win32') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (syncManager) {
    syncManager.stop();
  }
  if (networkMonitor) {
    networkMonitor.stop();
  }
  if (storage) {
    storage.close();
  }
  if (dbService) {
    dbService.close();
  }
});

