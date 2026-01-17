# Changelog

All notable changes to Personal Hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for V1
- Links management with tags and search
- Internal store catalog with filtering
- Download manager with queue system
- Per-tool settings UI pages
- Enhanced activity history with filters
- Password change functionality
- User profile customization

### Planned for V2+
- Remote store with tool downloads
- Multi-machine cloud sync
- Python tool support via subprocess
- System metrics dashboard (CPU/RAM/Network)
- Plugin marketplace
- Multi-language support
- Theme customization

## [0.1.0] - 2024-01-XX (V0 - MVP)

### Added

#### Core Features
- **Electron + React Architecture**
  - Main process with service layer
  - React UI with Vite dev server
  - Preload bridge with contextIsolation
  - Secure IPC communication

- **Authentication System**
  - Local login/password with bcrypt hashing
  - Session management with token
  - Remember me functionality
  - Auto-restore session on startup
  - Default credentials: admin/admin

- **Permission System**
  - 10 granular permissions (NET_ACCESS, FS_READ, FS_WRITE, etc.)
  - Per-tool permission requirements
  - User profile with permission toggles
  - Permission checks before tool execution
  - Permission denied logging and UI feedback

- **Tool System**
  - Plugin architecture with manifest.json
  - Service layer for backend logic
  - UI components per tool
  - Tool configuration management
  - Automatic tool loading from tools/ directory
  - Tag-based filtering and search

- **Example Tools**
  - YouTube Downloader (placeholder, needs yt-dlp)
  - PDF Tools (placeholder for V1 implementation)

- **Storage & Logging**
  - JSON store for auth, profile, configs
  - SQLite store for action history
  - Automatic logging of user actions
  - Security event logging (permission denied, etc.)
  - Log viewer UI in Settings

- **System Integration**
  - System tray icon and menu
  - Minimize to tray on close
  - Auto-launch on Windows startup
  - Native file/folder pickers
  - Open path in Explorer

- **Network Monitoring**
  - Periodic connectivity check
  - Online/offline status detection
  - Offline mode UI with banner
  - Disabled internet-required tools when offline

- **UI/UX**
  - Modern dark theme admin panel
  - Sidebar navigation
  - Dashboard with system status
  - Tool cards with tags
  - Search and filter
  - Responsive layout
  - Loading and error states

#### Pages
- Login page with credentials and remember me
- Home dashboard with status and recent activity
- Tools page with grid, search, and tag filters
- Profile page with user info and permission toggles
- Settings page with auto-launch and logs viewer
- Offline page with information
- Placeholder pages for Links and Store

#### Security
- Context isolation enabled
- Sandboxed renderer process
- No direct Node.js access from UI
- IPC channel whitelist
- Input validation
- Password hashing with bcrypt
- Secure storage paths

### Technical Stack
- Electron 28.x
- React 18.x
- React Router v6
- Zustand (state management)
- Vite (build tool)
- better-sqlite3 (database)
- bcryptjs (password hashing)

### Developer Experience
- Hot reload in development
- PowerShell build scripts
- Comprehensive documentation
- Example tool implementation
- Clear project structure

## [0.0.1] - Initial Setup

### Added
- Project structure initialization
- Basic configuration files
- Documentation templates

---

## Version Guidelines

### Version Format
- **V0 (0.x.x)**: MVP with core features
- **V1 (1.x.x)**: Production-ready with complete feature set
- **V2 (2.x.x)**: Advanced features and ecosystem

### Semantic Versioning
- **Major (x.0.0)**: Breaking changes
- **Minor (0.x.0)**: New features, backward compatible
- **Patch (0.0.x)**: Bug fixes, backward compatible

### Release Process
1. Update CHANGELOG.md
2. Update version in package.json
3. Build and test
4. Create git tag
5. Build distributable
6. Create GitHub release
