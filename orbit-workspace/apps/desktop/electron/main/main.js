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
let isDev;

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
    icon: path.join(__dirname, '../../renderer/src/assets/v2.png')
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../../renderer/dist/index.html'));
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

  // Block new window creation (popups, target=_blank)
  mainWindow.webContents.setWindowOpenHandler(() => {
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

  console.log('✅ All services initialized');
}

function setupIpcHandlers() {
  // Auth handlers - with secure logging
  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (event, { email, username, password }) => {
    try {
      const startTime = Date.now();
      const result = await authService.register(email, username, password);

      logManager.log({
        type: 'auth:register',
        userId: result.success ? result.userId : null,
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

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, { identifier, password, rememberMe }) => {
    try {
      const startTime = Date.now();
      const result = await authService.login(identifier, password, rememberMe);

      logManager.log({
        type: 'auth:login',
        userId: result.success ? result.session?.userId : null,
        username: result.success ? result.session?.username : null,
        status: result.success ? 'success' : 'error',
        error: result.error || null,
        duration: Date.now() - startTime,
        payload: { action: 'login' }
      });

      // Strip token from response to renderer
      if (result.success && result.session) {
        const { token, ...safeSession } = result.session;
        return { ...result, session: safeSession };
      }
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
    // Don't expose token to renderer
    const { token, ...safeSession } = session;
    return safeSession;
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
    const session = await authService.getSession();
    if (!session) return [];
    return toolRunner.listTools();
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET, async (event, toolId) => {
    const session = await authService.getSession();
    if (!session) return null;
    return toolRunner.getTool(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_RUN, async (event, { toolId, action, payload }) => {
    const session = await authService.getSession();
    if (!session) return { success: false, error: 'Not authenticated' };
    return toolRunner.runTool(toolId, action, payload);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET_CONFIG, async (event, toolId) => {
    const session = await authService.getSession();
    if (!session) return {};
    return toolRunner.getToolConfig(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_SET_CONFIG, async (event, { toolId, config }) => {
    const session = await authService.getSession();
    if (!session) return { error: 'Not authenticated' };
    return toolRunner.setToolConfig(toolId, config);
  });

  // Filesystem handlers (auth-guarded)
  ipcMain.handle(IPC_CHANNELS.FS_PICK_FILE, async (event, options) => {
    try {
      const session = await authService.getSession();
      if (!session) return null;

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
      const session = await authService.getSession();
      if (!session) return null;

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
      const session = await authService.getSession();
      if (!session) return null;

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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

  // System handlers (auth-guarded)
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_STATUS, async () => {
    const session = await authService.getSession();
    if (!session) return null;
    return {
      online: networkMonitor.getStatus(),
      appVersion: app.getVersion(),
      platform: process.platform,
      autoLaunchEnabled: await autoLaunch.isEnabled()
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SET_AUTOLAUNCH, async (event, enabled) => {
    const session = await authService.getSession();
    if (!session) return { success: false, error: 'Not authenticated' };

    return autoLaunch.toggle(enabled);
  });

  // Logs handlers - user-specific only
  ipcMain.handle(IPC_CHANNELS.LOGS_TAIL, async (event, { type, limit }) => {
    try {
      const session = await authService.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

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
      const session = await authService.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const settings = repos.userSettings.findByUserId(session.userId);

      if (!settings || !settings.active_workspace_id) {
        return { success: false, error: 'No active workspace' };
      }

      const workspace = repos.workspaces.findById(settings.active_workspace_id);
      return { success: true, workspace };
    } catch (error) {
      console.error('Get active workspace error:', error);
      return { success: false, error: 'Failed to get active workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE, async (event, { name }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const workspace = repos.workspaces.create(session.userId, name);

      return { success: true, workspace };
    } catch (error) {
      console.error('Create workspace error:', error);
      return { success: false, error: 'Failed to create workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_UPDATE, async (event, { id, name }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(id, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.updateName(id, name);
      const workspace = repos.workspaces.findById(id);

      return { success: true, workspace };
    } catch (error) {
      console.error('Update workspace error:', error);
      return { success: false, error: 'Failed to update workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (event, { id }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(id, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Delete workspace error:', error);
      return { success: false, error: 'Failed to delete workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SWITCH, async (event, { workspaceId }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.userSettings.updateActiveWorkspace(session.userId, workspaceId);
      const workspace = repos.workspaces.findById(workspaceId);

      return { success: true, workspace };
    } catch (error) {
      console.error('Switch workspace error:', error);
      return { success: false, error: 'Failed to switch workspace' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_TOOLS, async (event, { workspaceId }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.addTool(workspaceId, toolId);
      return { success: true };
    } catch (error) {
      console.error('Add workspace tool error:', error);
      return { success: false, error: 'Failed to add tool' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE_TOOL, async (event, { workspaceId, toolId }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();

      // Check ownership
      if (!repos.workspaces.isOwner(workspaceId, session.userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      repos.workspaces.removeTool(workspaceId, toolId);
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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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

      return { success: true, note };
    } catch (error) {
      console.error('Create note error:', error);
      return { success: false, error: 'Failed to create note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_UPDATE, async (event, { id, title, content, tags }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      repos.notes.update(id, { title, content, tags });
      const updated = repos.notes.findById(id);

      return { success: true, note: updated };
    } catch (error) {
      console.error('Update note error:', error);
      return { success: false, error: 'Failed to update note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_DELETE, async (event, { id }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      repos.notes.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Delete note error:', error);
      return { success: false, error: 'Failed to delete note' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_SEARCH, async (event, { workspaceId, query }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const note = repos.notes.findById(id);

      if (!note || note.user_id !== session.userId) {
        return { success: false, error: 'Note not found' };
      }

      repos.notes.togglePin(id);
      const updated = repos.notes.findById(id);

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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

      return { success: true, link };
    } catch (error) {
      console.error('Create link error:', error);
      return { success: false, error: 'Failed to create link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_UPDATE, async (event, { id, title, url, description, tags }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      repos.links.update(id, { title, url, description, tags });
      const updated = repos.links.findById(id);

      return { success: true, link: updated };
    } catch (error) {
      console.error('Update link error:', error);
      return { success: false, error: 'Failed to update link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_DELETE, async (event, { id }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      repos.links.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Delete link error:', error);
      return { success: false, error: 'Failed to delete link' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LINK_SEARCH, async (event, { workspaceId, query }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const link = repos.links.findById(id);

      if (!link || link.user_id !== session.userId) {
        return { success: false, error: 'Link not found' };
      }

      repos.links.toggleFavorite(id);
      const updated = repos.links.findById(id);

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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

      return { success: true, file: fileRef };
    } catch (error) {
      console.error('Create file reference error:', error);
      return { success: false, error: 'Failed to create file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_UPDATE, async (event, { id, name, path, description, tags }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      repos.fileReferences.update(id, { name, path, description, tags });
      const updated = repos.fileReferences.findById(id);

      return { success: true, file: updated };
    } catch (error) {
      console.error('Update file reference error:', error);
      return { success: false, error: 'Failed to update file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_DELETE, async (event, { id }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const repos = dbService.getRepositories();
      const fileRef = repos.fileReferences.findById(id);

      if (!fileRef || fileRef.user_id !== session.userId) {
        return { success: false, error: 'File reference not found' };
      }

      repos.fileReferences.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Delete file reference error:', error);
      return { success: false, error: 'Failed to delete file reference' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_REF_SEARCH, async (event, { workspaceId, query }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
  // BADGES HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.BADGE_GET_ALL, async () => {
    try {
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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Users can only get their own badges unless they're admin
      if (userId && userId !== session.userId && session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const repos = dbService.getRepositories();
      const badges = repos.badges.findByUserId(userId || session.userId);
      return { success: true, badges };
    } catch (error) {
      console.error('Get user badges error:', error);
      return { success: false, error: 'Failed to get user badges' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BADGE_ASSIGN, async (event, payload = {}) => {
    try {
      const { userId, badgeId } = payload;
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins can assign badges
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      if (!userId || !badgeId) {
        return { success: false, error: 'Missing badge assignment parameters' };
      }

      const repos = dbService.getRepositories();

      // Get badge info for notification
      const badge = repos.badges.findAll().find((b) => b.id === badgeId);
      if (!badge) {
        return { success: false, error: 'Badge not found' };
      }

      repos.badges.assign(userId, badgeId, session.userId);

      // Create inbox notification
      repos.inbox.createBadgeAssignedMessage(userId, badge.display_name, session.username);
      if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);

      return { success: true };
    } catch (error) {
      console.error('Assign badge error:', error);
      return { success: false, error: 'Failed to assign badge' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BADGE_REVOKE, async (event, payload = {}) => {
    try {
      const { userId, badgeId } = payload;
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins can revoke badges
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      if (!userId || !badgeId) {
        return { success: false, error: 'Missing badge revoke parameters' };
      }

      const repos = dbService.getRepositories();

      // Get badge info before revoking
      const badge = repos.badges.findAll().find((b) => b.id === badgeId);
      if (!badge) {
        return { success: false, error: 'Badge not found' };
      }

      repos.badges.revoke(userId, badgeId);

      // Create inbox notification
      repos.inbox.createBadgeRevokedMessage(userId, badge.display_name, session.username);
      if (mainWindow?.webContents) mainWindow.webContents.send(IPC_CHANNELS.INBOX_NEW_MESSAGE);

      return { success: true };
    } catch (error) {
      console.error('Revoke badge error:', error);
      return { success: false, error: 'Failed to revoke badge' };
    }
  });

  // ========================================
  // INBOX HANDLERS
  // ========================================

  ipcMain.handle(IPC_CHANNELS.INBOX_GET_ALL, async () => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins and devs can view stats
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins and devs can view all users
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins and devs can view audit logs
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

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

  ipcMain.handle(IPC_CHANNELS.ADMIN_GET_OPERATIONS_STATUS, async () => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins and devs can view operations status
      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      const db = dbService.getDB();
      const nowSec = Math.floor(Date.now() / 1000);
      const since24hMs = Date.now() - 24 * 60 * 60 * 1000;

      const tableExists = (table) => {
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
        return !!row;
      };

      const safeCount = (table) => {
        if (!tableExists(table)) return 0;
        return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
      };

      const getFileMeta = (filePath) => {
        if (!filePath || !fs.existsSync(filePath)) {
          return { exists: false, sizeBytes: 0, updatedAt: null };
        }

        const stats = fs.statSync(filePath);
        return {
          exists: true,
          sizeBytes: stats.size,
          updatedAt: stats.mtimeMs
        };
      };

      const health = await dbService.healthCheck();
      const dbPath = health.dbPath || null;

      const sessions = {
        total: safeCount('sessions'),
        active: db.prepare('SELECT COUNT(*) as c FROM sessions WHERE expires_at > ?').get(nowSec).c,
        expired: db.prepare('SELECT COUNT(*) as c FROM sessions WHERE expires_at <= ?').get(nowSec).c
      };

      const activity = {
        logsLast24h: tableExists('action_logs')
          ? db.prepare('SELECT COUNT(*) as c FROM action_logs WHERE timestamp >= ?').get(since24hMs).c
          : 0,
        errorsLast24h: tableExists('action_logs')
          ? db.prepare("SELECT COUNT(*) as c FROM action_logs WHERE timestamp >= ? AND status = 'error'").get(since24hMs).c
          : 0,
        failedAuthLast24h: tableExists('action_logs')
          ? db
              .prepare("SELECT COUNT(*) as c FROM action_logs WHERE timestamp >= ? AND action_type LIKE 'auth:%' AND status = 'error'")
              .get(since24hMs).c
          : 0,
        pendingSyncOps: safeCount('sync_queue'),
        unresolvedConflicts: tableExists('sync_conflicts')
          ? db.prepare('SELECT COUNT(*) as c FROM sync_conflicts WHERE user_reviewed = 0').get().c
          : 0
      };

      const runtime = {
        online: networkMonitor.getStatus(),
        appVersion: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        uptimeSeconds: Math.round(process.uptime()),
        autoLaunchEnabled: await autoLaunch.isEnabled(),
        memory: process.memoryUsage()
      };

      const database = {
        health,
        path: dbPath,
        files: {
          main: getFileMeta(dbPath),
          wal: getFileMeta(dbPath ? `${dbPath}-wal` : null),
          shm: getFileMeta(dbPath ? `${dbPath}-shm` : null)
        },
        tables: {
          users: safeCount('users'),
          workspaces: safeCount('workspaces'),
          notes: safeCount('notes'),
          links: safeCount('links'),
          fileReferences: safeCount('file_references'),
          badges: safeCount('badges'),
          inboxMessages: safeCount('inbox_messages'),
          actionLogs: safeCount('action_logs'),
          syncQueue: safeCount('sync_queue'),
          syncConflicts: safeCount('sync_conflicts')
        },
        sessions
      };

      const checks = [
        {
          id: 'db-health',
          label: 'Database health',
          status: health.healthy ? 'ok' : 'error',
          value: health.healthy ? 'Healthy' : 'Unhealthy',
          details: health.error || `Encryption ${health.encryptionWorking ? 'working' : 'failed'}`
        },
        {
          id: 'session-hygiene',
          label: 'Session hygiene',
          status: sessions.expired > 0 ? 'warn' : 'ok',
          value: `${sessions.active} active`,
          details: `${sessions.expired} expired session(s) still present`
        },
        {
          id: 'sync-backlog',
          label: 'Sync backlog',
          status: activity.pendingSyncOps > 50 ? 'warn' : 'ok',
          value: `${activity.pendingSyncOps} queued`,
          details: `${activity.unresolvedConflicts} unresolved conflict(s)`
        },
        {
          id: 'error-rate',
          label: 'Errors (24h)',
          status: activity.errorsLast24h > 0 ? 'warn' : 'ok',
          value: `${activity.errorsLast24h} errors`,
          details: `${activity.failedAuthLast24h} failed auth event(s)`
        },
        {
          id: 'db-files',
          label: 'SQLite files',
          status: database.files.main.exists ? 'ok' : 'error',
          value: database.files.main.exists ? 'Detected' : 'Missing',
          details: dbPath || 'No DB file path detected'
        }
      ];

      return {
        success: true,
        operations: {
          runtime,
          database,
          activity,
          checks,
          generatedAt: Date.now()
        }
      };
    } catch (error) {
      console.error('Get operations status error:', error);
      return { success: false, error: 'Failed to get operations status' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_UPDATE_USER_ROLE, async (event, { userId, role }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins can update roles
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const validRoles = new Set(['USER', 'PREMIUM', 'DEV', 'ADMIN']);
      if (!userId || !validRoles.has(role)) {
        return { success: false, error: 'Invalid role update payload' };
      }

      const repos = dbService.getRepositories();
      const user = repos.users.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Prevent self-demotion
      if (userId === session.userId && role !== 'ADMIN') {
        return { success: false, error: 'Cannot change your own role' };
      }

      // Prevent removing the last admin
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
      return { success: false, error: 'Failed to update user role' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_UPDATE_USER_STATUS, async (event, { userId, status }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

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
      const user = repos.users.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Prevent disabling the last active admin
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
      return { success: false, error: 'Failed to update user status' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADMIN_SEND_NOTIFICATION, async (event, { title, message, target, userId, category }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
      }

      if (!title || !message) {
        return { success: false, error: 'Title and message are required' };
      }

      const repos = dbService.getRepositories();
      const senderUsername = session.username;

      const broadcastCategory = category || 'admin-broadcast';

      if (target === 'all') {
        const allUsers = repos.users.findAll();
        const results = repos.inbox.broadcastToUsers(
          allUsers.map((u) => u.id),
          title,
          message,
          senderUsername,
          broadcastCategory
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
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      if (session.role !== 'ADMIN' && session.role !== 'DEV') {
        return { success: false, error: 'Unauthorized' };
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
