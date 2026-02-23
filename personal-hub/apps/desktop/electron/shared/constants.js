// IPC Channel names
const IPC_CHANNELS = {
  // Auth
  AUTH_REGISTER: 'auth:register',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SESSION: 'auth:getSession',
  AUTH_CHANGE_PASSWORD: 'auth:changePassword',

  // Profile
  PROFILE_GET: 'profile:get',
  PROFILE_UPDATE: 'profile:update',

  // Permissions
  PERMISSIONS_CHECK: 'permissions:check',
  PERMISSIONS_SET: 'permissions:set',

  // Tools
  TOOLS_LIST: 'tools:list',
  TOOLS_GET: 'tools:get',
  TOOLS_RUN: 'tools:run',
  TOOLS_GET_CONFIG: 'tools:getConfig',
  TOOLS_SET_CONFIG: 'tools:setConfig',

  // Store
  STORE_GET_CATALOG: 'store:getCatalog',
  STORE_INSTALL_TOOL: 'store:installTool',
  STORE_UNINSTALL_TOOL: 'store:uninstallTool',

  // Filesystem
  FS_PICK_FILE: 'fs:pickFile',
  FS_PICK_FOLDER: 'fs:pickFolder',
  FS_SAVE_FILE: 'fs:saveFile',
  FS_OPEN_PATH: 'fs:openPath',

  // System
  SYSTEM_GET_STATUS: 'system:getStatus',
  SYSTEM_SET_AUTOLAUNCH: 'system:setAutoLaunch',
  SYSTEM_ONLINE_STATUS: 'system:onlineStatus',

  // Backup
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',

  // Logs
  LOGS_TAIL: 'logs:tail',
  LOGS_SEARCH: 'logs:search',
  LOGS_SUBSCRIBE: 'logs:subscribe',
  LOGS_UNSUBSCRIBE: 'logs:unsubscribe',

  // Workspaces
  WORKSPACE_GET_ALL: 'workspace:getAll',
  WORKSPACE_GET_ACTIVE: 'workspace:getActive',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_SWITCH: 'workspace:switch',
  WORKSPACE_GET_TOOLS: 'workspace:getTools',
  WORKSPACE_ADD_TOOL: 'workspace:addTool',
  WORKSPACE_REMOVE_TOOL: 'workspace:removeTool',

  // Notes
  NOTE_GET_ALL: 'note:getAll',
  NOTE_GET: 'note:get',
  NOTE_CREATE: 'note:create',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  NOTE_SEARCH: 'note:search',
  NOTE_TOGGLE_PIN: 'note:togglePin',

  // Links
  LINK_GET_ALL: 'link:getAll',
  LINK_GET: 'link:get',
  LINK_CREATE: 'link:create',
  LINK_UPDATE: 'link:update',
  LINK_DELETE: 'link:delete',
  LINK_SEARCH: 'link:search',
  LINK_TOGGLE_FAVORITE: 'link:toggleFavorite',

  // File References
  FILE_REF_GET_ALL: 'fileRef:getAll',
  FILE_REF_GET: 'fileRef:get',
  FILE_REF_CREATE: 'fileRef:create',
  FILE_REF_UPDATE: 'fileRef:update',
  FILE_REF_DELETE: 'fileRef:delete',
  FILE_REF_SEARCH: 'fileRef:search',
  FILE_REF_OPEN: 'fileRef:open',
  FILE_REF_SHOW_IN_FOLDER: 'fileRef:showInFolder',

  // Badges
  BADGE_GET_ALL: 'badge:getAll',
  BADGE_GET_USER_BADGES: 'badge:getUserBadges',
  BADGE_ASSIGN: 'badge:assign',
  BADGE_REVOKE: 'badge:revoke',

  // Inbox
  INBOX_GET_ALL: 'inbox:getAll',
  INBOX_GET_UNREAD_COUNT: 'inbox:getUnreadCount',
  INBOX_MARK_READ: 'inbox:markRead',
  INBOX_MARK_ALL_READ: 'inbox:markAllRead',
  INBOX_DELETE: 'inbox:delete',
  INBOX_DELETE_READ: 'inbox:deleteRead',

  // Admin
  ADMIN_GET_STATS: 'admin:getStats',
  ADMIN_GET_USERS: 'admin:getUsers',
  ADMIN_UPDATE_USER_ROLE: 'admin:updateUserRole',
  ADMIN_UPDATE_USER_STATUS: 'admin:updateUserStatus',

  // Recovery / Crypto
  CRYPTO_SAVE_RECOVERY_FILE: 'crypto:saveRecoveryFile',
  CRYPTO_RECOVER_WITH_FILE: 'crypto:recoverWithFile',
  CRYPTO_PICK_RECOVERY_FILE: 'crypto:pickRecoveryFile'
};

// User Roles
const ROLES = {
  ADMIN: 'ADMIN',
  DEV: 'DEV',
  PREMIUM: 'PREMIUM',
  USER: 'USER'
};

// Role Levels (higher = more permissions)
const ROLE_LEVELS = {
  ADMIN: 4,
  DEV: 3,
  PREMIUM: 2,
  USER: 1
};

// Permission types
const PERMISSIONS = {
  // Basic Permissions
  NET_ACCESS: 'NET_ACCESS',
  FS_READ: 'FS_READ',
  FS_WRITE: 'FS_WRITE',
  FS_PICKER: 'FS_PICKER',
  RUN_TOOL: 'RUN_TOOL',
  SPAWN_PROCESS: 'SPAWN_PROCESS',
  CLIPBOARD: 'CLIPBOARD',
  NOTIFICATIONS: 'NOTIFICATIONS',
  TRAY_CONTROL: 'TRAY_CONTROL',
  PREMIUM_TOOLS: 'PREMIUM_TOOLS',

  // Advanced Permissions (Admin/Dev only)
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_ALL_LOGS: 'VIEW_ALL_LOGS',
  SYSTEM_CONFIG: 'SYSTEM_CONFIG',
  INSTALL_TOOLS: 'INSTALL_TOOLS'
};

// Default permissions by role
const ROLE_PERMISSIONS = {
  ADMIN: [
    'NET_ACCESS',
    'FS_READ',
    'FS_WRITE',
    'FS_PICKER',
    'RUN_TOOL',
    'SPAWN_PROCESS',
    'CLIPBOARD',
    'NOTIFICATIONS',
    'TRAY_CONTROL',
    'PREMIUM_TOOLS',
    'MANAGE_USERS',
    'VIEW_ALL_LOGS',
    'SYSTEM_CONFIG',
    'INSTALL_TOOLS'
  ],
  DEV: [
    'NET_ACCESS',
    'FS_READ',
    'FS_WRITE',
    'FS_PICKER',
    'RUN_TOOL',
    'SPAWN_PROCESS',
    'CLIPBOARD',
    'NOTIFICATIONS',
    'TRAY_CONTROL',
    'PREMIUM_TOOLS',
    'VIEW_ALL_LOGS',
    'INSTALL_TOOLS'
  ],
  PREMIUM: [
    'NET_ACCESS',
    'FS_READ',
    'FS_WRITE',
    'FS_PICKER',
    'RUN_TOOL',
    'CLIPBOARD',
    'NOTIFICATIONS',
    'PREMIUM_TOOLS',
    'INSTALL_TOOLS'
  ],
  USER: [
    'FS_READ',
    'FS_PICKER',
    'RUN_TOOL',
    'CLIPBOARD',
    'NOTIFICATIONS'
  ]
};

// App paths
const APP_PATHS = {
  USER_DATA: 'userData',
  // REMOVED in v0.x: No JSON files, all data in SQLite database
  // AUTH: 'auth.json',     // Now in database: users, sessions tables
  // PROFILE: 'profile.json', // Now in database: users, user_settings tables
  // LINKS: 'links.json',   // Now in database: links table
  TOOLS_CONFIG: 'tools',  // Tool configs can remain in JSON for now
  LOGS: 'logs',           // Logs remain JSON-based for now
  DB: 'orbit.db'           // SQLite database file
};

// Log severities
const LOG_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Log categories
const LOG_CATEGORY = {
  AUTH: 'auth',
  TOOL: 'tool',
  SYSTEM: 'system',
  SECURITY: 'security'
};

module.exports = {
  IPC_CHANNELS,
  ROLES,
  ROLE_LEVELS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  APP_PATHS,

  LOG_SEVERITY,
  LOG_CATEGORY
};
