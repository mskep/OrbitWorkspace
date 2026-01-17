# Personal Hub

A Windows desktop application built with Electron and React that centralizes tools, links, and utilities in a modern admin panel interface.

## Features

### V0 (Current MVP)

- **Authentication**: Local login/password system with bcrypt encryption
- **Profile & Permissions**: Granular permission system with capability-based access control
- **Tools System**: Plugin-based architecture for integrating custom tools
- **Offline Mode**: Graceful degradation when internet is unavailable
- **System Integration**: Tray icon, autostart, and native Windows integration
- **Activity Logs**: SQLite-based logging and audit trail
- **Example Tools**: YouTube Downloader and PDF Tools

### Architecture

```
┌─────────────────┐
│  React UI       │  (Renderer Process)
│  (Frontend)     │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Preload │  (API Bridge)
    │ Script  │
    └────┬────┘
         │
┌────────▼────────┐
│ Electron Main   │  (Main Process)
│ - Auth Service  │
│ - Permissions   │
│ - Tool Runner   │
│ - Storage       │
└─────────────────┘
```

### Permission System

Each tool declares required permissions:
- `NET_ACCESS`: Internet access
- `FS_READ` / `FS_WRITE`: File system access
- `FS_PICKER`: File picker dialogs
- `RUN_TOOL`: Execute tool services
- `SPAWN_PROCESS`: Spawn external processes
- `CLIPBOARD`: Clipboard access
- `NOTIFICATIONS`: Windows notifications
- `TRAY_CONTROL`: Tray menu actions
- `PREMIUM_TOOLS`: Access to premium features

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

Or use PowerShell script:
```powershell
.\scripts\dev.ps1
```

### Default Credentials

- Username: `admin`
- Password: `admin`

### Building

Build the application:
```bash
npm run build
```

Create Windows installer:
```bash
npm run dist
```

Or use PowerShell scripts:
```powershell
.\scripts\build.ps1
.\scripts\pack.ps1
```

## Project Structure

```
personal-hub/
├── apps/
│   └── desktop/
│       ├── electron/
│       │   ├── main/           # Main process
│       │   │   ├── main.js     # Entry point
│       │   │   ├── tray.js     # System tray
│       │   │   ├── permissions.js
│       │   │   ├── toolRunner.js
│       │   │   ├── storage/    # Data persistence
│       │   │   └── security/   # Auth & crypto
│       │   ├── preload/        # IPC bridge
│       │   └── shared/         # Constants
│       └── renderer/           # React UI
│           ├── src/
│           │   ├── app/        # Layout & routing
│           │   ├── pages/      # Main pages
│           │   ├── components/ # Reusable components
│           │   ├── state/      # State management
│           │   └── api/        # API wrapper
│           └── styles/
├── tools/                      # Plugin tools
│   ├── youtube_downloader/
│   │   ├── manifest.json
│   │   ├── service/
│   │   └── ui/
│   └── pdf_tools/
├── data/                       # Seed data
└── scripts/                    # Build scripts
```

## Creating a Tool

1. Create a folder in `tools/` with your tool ID
2. Add `manifest.json`:

```json
{
  "id": "my_tool",
  "name": "My Tool",
  "version": "0.1.0",
  "description": "Tool description",
  "icon": "🔧",
  "tags": ["utility"],
  "entryRoute": "/tools/my_tool",
  "requiresInternet": false,
  "permissions": ["FS_READ", "FS_WRITE"],
  "premium": false,
  "defaultConfig": {}
}
```

3. Create `service/index.js` with your backend logic:

```javascript
module.exports = {
  myAction: async (payload) => {
    // Your logic here
    return { success: true, result: 'data' };
  }
};
```

4. Create `ui/ToolPage.jsx` for your UI
5. Restart the app

## Data Storage

Application data is stored in:
```
%APPDATA%/personal-hub/
├── auth.json           # Authentication
├── profile.json        # User profile
├── tools/              # Tool configs
├── logs/               # Log files
└── db.sqlite           # Action history
```

## API Bridge (window.hubAPI)

The preload script exposes a secure API to the renderer:

```javascript
// Auth
await window.hubAPI.auth.login({ username, password, rememberMe });
await window.hubAPI.auth.logout();

// Tools
const tools = await window.hubAPI.tools.list();
await window.hubAPI.tools.run({ toolId, action, payload });

// Filesystem (permission-controlled)
const folder = await window.hubAPI.fs.pickFolder();
await window.hubAPI.fs.openPath(path);

// System
const status = await window.hubAPI.system.getStatus();
await window.hubAPI.system.setAutoLaunch(true);

// Logs
const logs = await window.hubAPI.logs.tail({ limit: 50 });
```

## Roadmap

### V1
- [ ] Links management with tags
- [ ] Internal store catalog
- [ ] Download manager with queue
- [ ] Tool settings UI
- [ ] Enhanced history/audit

### V2+
- [ ] Remote store with tool downloads
- [ ] Multi-machine sync
- [ ] Python tool support
- [ ] System metrics dashboard
- [ ] Plugin marketplace

## Security

- Passwords hashed with bcrypt
- Context isolation enabled
- Sandboxed renderer process
- Permission-based access control
- No direct Node.js access from UI
- All IPC channels whitelisted

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI library
- **React Router**: Client-side routing
- **Zustand**: State management
- **Vite**: Build tool and dev server
- **SQLite**: Local database (better-sqlite3)
- **bcryptjs**: Password hashing

## Contributing

This is a personal project, but suggestions are welcome!

## License

MIT

## Author

Your Name
