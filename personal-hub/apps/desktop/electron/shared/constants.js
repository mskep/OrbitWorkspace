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

  // Filesystem
  FS_PICK_FILE: 'fs:pickFile',
  FS_PICK_FOLDER: 'fs:pickFolder',
  FS_SAVE_FILE: 'fs:saveFile',
  FS_OPEN_PATH: 'fs:openPath',

  // System
  SYSTEM_GET_STATUS: 'system:getStatus',
  SYSTEM_SET_AUTOLAUNCH: 'system:setAutoLaunch',
  SYSTEM_ONLINE_STATUS: 'system:onlineStatus',

  // Logs
  LOGS_TAIL: 'logs:tail',
  LOGS_SEARCH: 'logs:search'
};

// Permission types
const PERMISSIONS = {
  NET_ACCESS: 'NET_ACCESS',
  FS_READ: 'FS_READ',
  FS_WRITE: 'FS_WRITE',
  FS_PICKER: 'FS_PICKER',
  RUN_TOOL: 'RUN_TOOL',
  SPAWN_PROCESS: 'SPAWN_PROCESS',
  CLIPBOARD: 'CLIPBOARD',
  NOTIFICATIONS: 'NOTIFICATIONS',
  TRAY_CONTROL: 'TRAY_CONTROL',
  PREMIUM_TOOLS: 'PREMIUM_TOOLS'
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
  username: 'user',
  permissions: Object.values(PERMISSIONS),
  premiumEnabled: false,
  createdAt: Date.now()
};

module.exports = {
  IPC_CHANNELS,
  PERMISSIONS,
  APP_PATHS,
  DEFAULT_PROFILE
};
