// Mirror of client-side constants (apps/desktop/electron/shared/constants.js)
// Keep in sync with client when roles or permissions change.

export const ROLES = {
  ADMIN: 'ADMIN',
  DEV: 'DEV',
  PREMIUM: 'PREMIUM',
  USER: 'USER',
};

export const ROLE_LEVELS = {
  ADMIN: 4,
  DEV: 3,
  PREMIUM: 2,
  USER: 1,
};

export const PERMISSIONS = {
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
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_ALL_LOGS: 'VIEW_ALL_LOGS',
  SYSTEM_CONFIG: 'SYSTEM_CONFIG',
  INSTALL_TOOLS: 'INSTALL_TOOLS',
};

export const ROLE_PERMISSIONS = {
  ADMIN: Object.values(PERMISSIONS),
  DEV: [
    'NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL',
    'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL',
    'PREMIUM_TOOLS', 'VIEW_ALL_LOGS', 'INSTALL_TOOLS',
  ],
  PREMIUM: [
    'NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL',
    'CLIPBOARD', 'NOTIFICATIONS', 'PREMIUM_TOOLS', 'INSTALL_TOOLS',
  ],
  USER: [
    'FS_READ', 'FS_PICKER', 'RUN_TOOL', 'CLIPBOARD', 'NOTIFICATIONS',
  ],
};

// Valid entity types for sync blobs
export const SYNC_ENTITY_TYPES = [
  'note',
  'link',
  'file_ref',
  'workspace',
  'user_settings',
];

// Device limits
export const MAX_DEVICES_PER_USER = 5;
