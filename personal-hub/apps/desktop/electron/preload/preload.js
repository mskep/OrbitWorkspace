const { contextBridge, ipcRenderer } = require('electron');
const { IPC_CHANNELS } = require('../shared/constants');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('hubAPI', {
  // Auth
  auth: {
    register: (credentials) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_REGISTER, credentials),
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

  // Workspaces
  workspaces: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_ALL),
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_ACTIVE),
    create: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE, data),
    update: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE, data),
    delete: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE, data),
    switch: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SWITCH, data),
    getTools: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_TOOLS, data),
    addTool: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ADD_TOOL, data),
    removeTool: (data) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REMOVE_TOOL, data)
  },

  // Notes
  notes: {
    getAll: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_GET_ALL, data),
    get: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_GET, data),
    create: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_CREATE, data),
    update: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_UPDATE, data),
    delete: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_DELETE, data),
    search: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_SEARCH, data),
    togglePin: (data) => ipcRenderer.invoke(IPC_CHANNELS.NOTE_TOGGLE_PIN, data)
  },

  // Links
  links: {
    getAll: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_GET_ALL, data),
    get: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_GET, data),
    create: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_CREATE, data),
    update: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_UPDATE, data),
    delete: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_DELETE, data),
    search: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_SEARCH, data),
    toggleFavorite: (data) => ipcRenderer.invoke(IPC_CHANNELS.LINK_TOGGLE_FAVORITE, data)
  },

  // File References
  fileRefs: {
    getAll: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_GET_ALL, data),
    get: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_GET, data),
    create: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_CREATE, data),
    update: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_UPDATE, data),
    delete: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_DELETE, data),
    search: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_SEARCH, data),
    open: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_OPEN, data)
  },

  // Badges
  badges: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.BADGE_GET_ALL),
    getUserBadges: (data) => ipcRenderer.invoke(IPC_CHANNELS.BADGE_GET_USER_BADGES, data),
    assign: (data) => ipcRenderer.invoke(IPC_CHANNELS.BADGE_ASSIGN, data),
    revoke: (data) => ipcRenderer.invoke(IPC_CHANNELS.BADGE_REVOKE, data)
  },

  // Inbox
  inbox: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.INBOX_GET_ALL),
    getUnreadCount: () => ipcRenderer.invoke(IPC_CHANNELS.INBOX_GET_UNREAD_COUNT),
    markRead: (data) => ipcRenderer.invoke(IPC_CHANNELS.INBOX_MARK_READ, data),
    markAllRead: () => ipcRenderer.invoke(IPC_CHANNELS.INBOX_MARK_ALL_READ),
    delete: (data) => ipcRenderer.invoke(IPC_CHANNELS.INBOX_DELETE, data),
    deleteRead: () => ipcRenderer.invoke(IPC_CHANNELS.INBOX_DELETE_READ)
  },

  // Admin
  admin: {
    getStats: () => ipcRenderer.invoke(IPC_CHANNELS.ADMIN_GET_STATS),
    getUsers: () => ipcRenderer.invoke(IPC_CHANNELS.ADMIN_GET_USERS),
    updateUserRole: (data) => ipcRenderer.invoke(IPC_CHANNELS.ADMIN_UPDATE_USER_ROLE, data),
    updateUserStatus: (data) => ipcRenderer.invoke(IPC_CHANNELS.ADMIN_UPDATE_USER_STATUS, data)
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
});
