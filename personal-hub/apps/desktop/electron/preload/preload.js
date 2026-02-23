const { contextBridge, ipcRenderer } = require('electron');

// IPC channel names inlined for sandbox compatibility (no require() for non-electron modules)
const IPC_CHANNELS = {
  AUTH_REGISTER: 'auth:register',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SESSION: 'auth:getSession',
  PROFILE_GET: 'profile:get',
  PROFILE_UPDATE: 'profile:update',
  PERMISSIONS_CHECK: 'permissions:check',
  PERMISSIONS_SET: 'permissions:set',
  TOOLS_LIST: 'tools:list',
  TOOLS_GET: 'tools:get',
  TOOLS_RUN: 'tools:run',
  TOOLS_GET_CONFIG: 'tools:getConfig',
  TOOLS_SET_CONFIG: 'tools:setConfig',
  FS_PICK_FILE: 'fs:pickFile',
  FS_PICK_FOLDER: 'fs:pickFolder',
  FS_SAVE_FILE: 'fs:saveFile',
  FS_OPEN_PATH: 'fs:openPath',
  SYSTEM_GET_STATUS: 'system:getStatus',
  SYSTEM_SET_AUTOLAUNCH: 'system:setAutoLaunch',
  SYSTEM_ONLINE_STATUS: 'system:onlineStatus',
  LOGS_TAIL: 'logs:tail',
  LOGS_SEARCH: 'logs:search',
  WORKSPACE_GET_ALL: 'workspace:getAll',
  WORKSPACE_GET_ACTIVE: 'workspace:getActive',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_SWITCH: 'workspace:switch',
  WORKSPACE_GET_TOOLS: 'workspace:getTools',
  WORKSPACE_ADD_TOOL: 'workspace:addTool',
  WORKSPACE_REMOVE_TOOL: 'workspace:removeTool',
  NOTE_GET_ALL: 'note:getAll',
  NOTE_GET: 'note:get',
  NOTE_CREATE: 'note:create',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  NOTE_SEARCH: 'note:search',
  NOTE_TOGGLE_PIN: 'note:togglePin',
  LINK_GET_ALL: 'link:getAll',
  LINK_GET: 'link:get',
  LINK_CREATE: 'link:create',
  LINK_UPDATE: 'link:update',
  LINK_DELETE: 'link:delete',
  LINK_SEARCH: 'link:search',
  LINK_TOGGLE_FAVORITE: 'link:toggleFavorite',
  FILE_REF_GET_ALL: 'fileRef:getAll',
  FILE_REF_GET: 'fileRef:get',
  FILE_REF_CREATE: 'fileRef:create',
  FILE_REF_UPDATE: 'fileRef:update',
  FILE_REF_DELETE: 'fileRef:delete',
  FILE_REF_SEARCH: 'fileRef:search',
  FILE_REF_OPEN: 'fileRef:open',
  FILE_REF_SHOW_IN_FOLDER: 'fileRef:showInFolder',
  BADGE_GET_ALL: 'badge:getAll',
  BADGE_GET_USER_BADGES: 'badge:getUserBadges',
  BADGE_ASSIGN: 'badge:assign',
  BADGE_REVOKE: 'badge:revoke',
  INBOX_GET_ALL: 'inbox:getAll',
  INBOX_GET_UNREAD_COUNT: 'inbox:getUnreadCount',
  INBOX_MARK_READ: 'inbox:markRead',
  INBOX_MARK_ALL_READ: 'inbox:markAllRead',
  INBOX_DELETE: 'inbox:delete',
  INBOX_DELETE_READ: 'inbox:deleteRead',
  ADMIN_GET_STATS: 'admin:getStats',
  ADMIN_GET_USERS: 'admin:getUsers',
  ADMIN_UPDATE_USER_ROLE: 'admin:updateUserRole',
  ADMIN_UPDATE_USER_STATUS: 'admin:updateUserStatus',
  CRYPTO_SAVE_RECOVERY_FILE: 'crypto:saveRecoveryFile',
  CRYPTO_RECOVER_WITH_FILE: 'crypto:recoverWithFile',
};

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
    pickFile: (options) => ipcRenderer.invoke(IPC_CHANNELS.FS_PICK_FILE, options),
    pickFolder: (options) => ipcRenderer.invoke(IPC_CHANNELS.FS_PICK_FOLDER, options),
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
    open: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_OPEN, data),
    showInFolder: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILE_REF_SHOW_IN_FOLDER, data)
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

  // Recovery / Crypto
  crypto: {
    saveRecoveryFile: (data) => ipcRenderer.invoke(IPC_CHANNELS.CRYPTO_SAVE_RECOVERY_FILE, data),
    recoverWithFile: (data) => ipcRenderer.invoke(IPC_CHANNELS.CRYPTO_RECOVER_WITH_FILE, data),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
});
