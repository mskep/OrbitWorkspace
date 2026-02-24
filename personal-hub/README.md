# Orbit

A privacy-first Windows desktop productivity hub built with Electron and React. Centralizes notes, links, tools, and notifications in a secure, multi-user environment with zero-knowledge encryption.

## Features

- **Multi-user Auth**: Local SQLite-based auth with Argon2id key derivation and zero-knowledge encryption
- **Workspaces**: Isolated workspaces with notes, links, and file references
- **Inbox & Notifications**: Real-time notification system with admin broadcasts (IPC push, no polling)
- **Admin Panel**: User management, role system, badge assignment, broadcast notifications, system logs
- **Notes & Links**: Rich workspace-scoped content management
- **Profile & Badges**: User profiles with assignable badges
- **Offline Mode**: Fully local-first, graceful degradation
- **System Integration**: Tray icon, autostart, native Windows integration

### Architecture

```
┌─────────────────┐
│  React UI       │  (Renderer Process — sandboxed)
│  + Zustand      │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Preload │  (contextIsolation + IPC bridge)
    │ Script  │
    └────┬────┘
         │
┌────────▼────────┐
│ Electron Main   │  (Main Process)
│ - AuthService   │  (SQLite + Argon2id + session revalidation)
│ - Encryption    │  (AES-256-GCM, per-user master keys)
│ - Database      │  (better-sqlite3 with migrations)
│ - Permissions   │  (RBAC: ADMIN, DEV, MEMBER, GUEST)
│ - ToolRunner    │
└─────────────────┘
```

### Permission System

Role-based access control (ADMIN > DEV > MEMBER > GUEST):
- `NET_ACCESS`: Internet access
- `FS_READ` / `FS_WRITE`: File system access
- `FS_PICKER`: File picker dialogs
- `RUN_TOOL`: Execute tool services
- `SPAWN_PROCESS`: Spawn external processes
- `CLIPBOARD`: Clipboard access
- `NOTIFICATIONS`: Desktop notifications
- `TRAY_CONTROL`: Tray menu actions
- `PREMIUM_TOOLS`: Premium features
- `MANAGE_USERS` / `VIEW_ALL_LOGS` / `SYSTEM_CONFIG`: Admin-only

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Windows 10/11

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd personal-hub
```

2. Install dependencies
```bash
npm install
cd apps/desktop/renderer
npm install
cd ../../..
```

3. Run in development mode
```bash
npm run dev
```

### First Launch

On first launch, create your admin account through the registration page. The first registered user automatically gets the ADMIN role.

### Building

```bash
npm run build    # Build the app
npm run dist     # Create Windows installer
```

## Project Structure

```
personal-hub/
├── apps/
│   └── desktop/
│       ├── electron/
│       │   ├── main/
│       │   │   ├── main.js         # Entry point + IPC handlers
│       │   │   ├── tray.js         # System tray
│       │   │   ├── database/       # SQLite DB + migrations + repositories
│       │   │   └── security/       # Auth, encryption, crypto, permissions
│       │   ├── preload/            # IPC bridge (contextIsolation)
│       │   └── shared/             # Constants
│       └── renderer/               # React UI
│           ├── src/
│           │   ├── app/            # Layout, routing, sidebar
│           │   ├── pages/          # Home, Notes, Links, Inbox, Profile, Settings, Admin
│           │   ├── components/     # Card, Modal, Topbar
│           │   ├── state/          # Zustand store
│           │   └── api/            # hubAPI wrapper
│           └── styles/
├── tools/                          # Plugin tools
└── scripts/                        # Build scripts
```

## Data Storage

Application data is stored in:
```
%APPDATA%/orbit/
├── .session-token    # Persisted session token
├── .orbit-key        # Local encryption key
└── orbit.db          # SQLite database (encrypted content)
```

## Security

- **Zero-knowledge encryption**: AES-256-GCM with per-user master keys derived via Argon2id
- **Session revalidation**: Sessions revalidated against DB every 60s (expiration, status, role)
- **Context isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **CSP**: Content Security Policy enforced via meta tag
- **Navigation lock**: External navigation and popup windows blocked
- **Admin guards**: Backend prevents self-demotion and last-admin removal
- **RBAC**: All IPC handlers check session + role before execution
- **Recovery**: Encrypted recovery key file for account recovery

## Technology Stack

- **Electron** — Desktop framework
- **React** — UI library
- **React Router** — Client-side routing
- **Zustand** — State management
- **Vite** — Build tool
- **better-sqlite3** — Local database
- **Argon2id** — Key derivation
- **Lucide React** — Icons

## License

MIT
