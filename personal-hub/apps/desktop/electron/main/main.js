const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// Verify Electron loaded correctly
if (!app) {
  console.error('ERROR: Electron app module not loaded!');
  console.error('Make sure you run this with: npx electron . (from project root)');
  process.exit(1);
}

// Disable GPU cache to avoid permission errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Import managers
const StorageManager = require('./storage');
const AuthService = require('./security/authService');
const PermissionsManager = require('./permissions');
const ToolRunner = require('./toolRunner');
const NetworkMonitor = require('./netMonitor');
const TrayManager = require('./tray');
const AutoLaunch = require('./autoLaunch');

const { IPC_CHANNELS } = require('../shared/constants');

let mainWindow;
let trayManager;
let storage;
let authService;
let permissionsManager;
let toolRunner;
let networkMonitor;
let autoLaunch;
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
  // Initialize storage
  const userDataPath = app.getPath('userData');
  storage = new StorageManager(userDataPath);
  await storage.initialize();

  // Initialize services
  authService = new AuthService(storage);
  await authService.initialize();

  permissionsManager = new PermissionsManager(storage);

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

  // Auto launch
  autoLaunch = new AutoLaunch();

  console.log('All services initialized');
}

function setupIpcHandlers() {
  // Auth handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, { username, password, rememberMe }) => {
    return authService.login(username, password, rememberMe);
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

  // Logs handlers
  ipcMain.handle(IPC_CHANNELS.LOGS_TAIL, async (event, { type, limit }) => {
    return storage.getActions({ type, limit: limit || 50 });
  });

  ipcMain.handle(IPC_CHANNELS.LOGS_SEARCH, async (event, query) => {
    return storage.searchActions(query);
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
}

app.whenReady().then(async () => {
  await initializeServices();

  // Try to restore session
  await authService.restoreSession();

  createWindow();

  // Create tray
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
});
