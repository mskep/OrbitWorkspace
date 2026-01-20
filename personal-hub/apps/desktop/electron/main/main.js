const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

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
      sandbox: false
    },
    frame: false,
    show: false,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hidden'
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

  // Initialize old storage manager (for logs compatibility)
  storage = new StorageManager(userDataPath);
  await storage.initialize();

  // Initialize auth service with SQLite database
  authService = new AuthService(dbService);
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
  // Auth handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (event, { email, username, password }) => {
    return authService.register(email, username, password);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, { identifier, password, rememberMe }) => {
    return authService.login(identifier, password, rememberMe);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    return authService.logout();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    return authService.getSession();
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

  // Tools handlers
  ipcMain.handle(IPC_CHANNELS.TOOLS_LIST, async () => {
    return toolRunner.listTools();
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET, async (event, toolId) => {
    return toolRunner.getTool(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_RUN, async (event, { toolId, action, payload }) => {
    return toolRunner.runTool(toolId, action, payload);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET_CONFIG, async (event, toolId) => {
    return toolRunner.getToolConfig(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.TOOLS_SET_CONFIG, async (event, { toolId, config }) => {
    return toolRunner.setToolConfig(toolId, config);
  });

  // Filesystem handlers
  ipcMain.handle(IPC_CHANNELS.FS_PICK_FILE, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.FS_PICK_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.FS_SAVE_FILE, async (event, { defaultPath, filters }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_PATH, async (event, filePath) => {
    shell.openPath(filePath);
    return { success: true };
  });

  // System handlers
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_STATUS, async () => {
    return {
      online: networkMonitor.getStatus(),
      appVersion: app.getVersion(),
      platform: process.platform,
      autoLaunchEnabled: await autoLaunch.isEnabled()
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SET_AUTOLAUNCH, async (event, enabled) => {
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

  ipcMain.handle(IPC_CHANNELS.BADGE_GET_USER_BADGES, async (event, { userId }) => {
    try {
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

  ipcMain.handle(IPC_CHANNELS.BADGE_ASSIGN, async (event, { userId, badgeId }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins can assign badges
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const repos = dbService.getRepositories();
      repos.badges.assign(userId, badgeId, session.userId);

      // Get badge info for notification
      const badge = repos.badges.findAll().find(b => b.id === badgeId);
      const user = repos.users.findById(userId);

      // Create inbox notification
      repos.inbox.createBadgeAssignedMessage(userId, badge.display_name, session.username);

      return { success: true };
    } catch (error) {
      console.error('Assign badge error:', error);
      return { success: false, error: 'Failed to assign badge' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BADGE_REVOKE, async (event, { userId, badgeId }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins can revoke badges
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const repos = dbService.getRepositories();

      // Get badge info before revoking
      const badge = repos.badges.findAll().find(b => b.id === badgeId);

      repos.badges.revoke(userId, badgeId);

      // Create inbox notification
      repos.inbox.createBadgeRevokedMessage(userId, badge.display_name, session.username);

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

      const stats = {
        totalUsers: repos.users.count(),
        activeUsers: repos.users.countActive(30),
        disabledUsers: repos.users.countDisabled(),
        usersPerMonth: repos.users.getUsersPerMonth(12)
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

  ipcMain.handle(IPC_CHANNELS.ADMIN_UPDATE_USER_ROLE, async (event, { userId, role }) => {
    try {
      const session = await authService.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      // Only admins can update roles
      if (session.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const repos = dbService.getRepositories();
      const user = repos.users.findById(userId);
      const oldRole = user.role;

      repos.users.updateRole(userId, role);

      // Create inbox notification
      repos.inbox.createRoleChangedMessage(userId, oldRole, role, session.username);

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

      const repos = dbService.getRepositories();
      repos.users.updateStatus(userId, status);

      return { success: true };
    } catch (error) {
      console.error('Update user status error:', error);
      return { success: false, error: 'Failed to update user status' };
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
