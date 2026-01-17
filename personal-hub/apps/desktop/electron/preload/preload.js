const { contextBridge, ipcRenderer } = require('electron');
const { IPC_CHANNELS } = require('../shared/constants');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('hubAPI', {
  // Auth
  auth: {
    login: (credentials) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    getSession: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SESSION)
  },

  // Profile
  profile: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_GET),
    update: (updates) => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_UPDATE, updates)
  },

  // Permissions
  permissions: {
    check: (data) => ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_CHECK, data),
    set: (data) => ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_SET, data)
  },

  // Tools
  tools: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_LIST),
    get: (toolId) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_GET, toolId),
    run: (data) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_RUN, data),
    getConfig: (toolId) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_GET_CONFIG, toolId),
    setConfig: (data) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_SET_CONFIG, data)
  },

  // Filesystem
  fs: {
    pickFile: () => ipcRenderer.invoke(IPC_CHANNELS.FS_PICK_FILE),
    pickFolder: () => ipcRenderer.invoke(IPC_CHANNELS.FS_PICK_FOLDER),
    saveFile: (data) => ipcRenderer.invoke(IPC_CHANNELS.FS_SAVE_FILE, data),
    openPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.FS_OPEN_PATH, path)
  },

  // System
  system: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_STATUS),
    setAutoLaunch: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SET_AUTOLAUNCH, enabled),
    onOnlineStatus: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.SYSTEM_ONLINE_STATUS, (event, status) => callback(status));
    }
  },

  // Logs
  logs: {
    tail: (options) => ipcRenderer.invoke(IPC_CHANNELS.LOGS_TAIL, options),
    search: (query) => ipcRenderer.invoke(IPC_CHANNELS.LOGS_SEARCH, query)
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
});
