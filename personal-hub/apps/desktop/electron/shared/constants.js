// IPC Channel names
const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SESSION: 'auth:getSession',

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
  LOGS_UNSUBSCRIBE: 'logs:unsubscribe'
};

// User Roles
const ROLES = {
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
  VIP: 'VIP',
  USER: 'USER'
};

// Role Levels (higher = more permissions)
const ROLE_LEVELS = {
  ADMIN: 4,
  DEVELOPER: 3,
  VIP: 2,
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
  DEVELOPER: [
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
  VIP: [
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
  AUTH: 'auth.json',
  PROFILE: 'profile.json',
  LINKS: 'links.json',
  TOOLS_CONFIG: 'tools',
  LOGS: 'logs',
  DB: 'db.sqlite'
};

// Default profile
const DEFAULT_PROFILE = {
  userId: null,
  username: 'admin',
  email: 'admin@personalhub.local',
  role: 'ADMIN',
  roleLevel: 4,
  avatar: {
    type: 'initials',
    color: '#6366f1',
    initials: 'AD'
  },
  createdAt: Date.now(),
  lastLogin: Date.now(),
  loginCount: 0,
  premium: true,
  premiumSince: Date.now(),
  premiumUntil: null,
  permissions: {
    granted: ROLE_PERMISSIONS.ADMIN,
    denied: [],
    restricted: []
  },
  settings: {
    theme: 'dark',
    language: 'en',
    notifications: true,
    autoLaunch: false
  },
  stats: {
    totalActions: 0,
    toolsUsed: 0,
    favoriteTools: [],
    lastActiveTools: []
  }
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
  DEFAULT_PROFILE,
  LOG_SEVERITY,
  LOG_CATEGORY
};
