# Personal Hub - Architecture Documentation

## Vue d'ensemble

Personal Hub est une application desktop Windows construite avec Electron et React, suivant une architecture strictement séparée en 3 couches pour la sécurité et la maintenabilité.

## Architecture des processus

```
┌──────────────────────────────────────────────────────┐
│                  Renderer Process                     │
│                    (React UI)                         │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐     │
│  │   Pages    │  │ Components│  │ State Mgmt  │     │
│  └────────────┘  └──────────┘  └─────────────┘     │
└──────────────────────┬───────────────────────────────┘
                       │
                  IPC Invoke
                       │
┌──────────────────────▼───────────────────────────────┐
│              Preload Script (Bridge)                  │
│    window.hubAPI.* (Whitelisted methods)             │
└──────────────────────┬───────────────────────────────┘
                       │
                  IPC Handle
                       │
┌──────────────────────▼───────────────────────────────┐
│                  Main Process                         │
│  ┌──────────────────────────────────────────────┐   │
│  │  Services Layer                              │   │
│  │  - AuthService                               │   │
│  │  - PermissionsManager                        │   │
│  │  - ToolRunner                                │   │
│  │  - StorageManager (JSON + SQLite)            │   │
│  │  - NetworkMonitor                            │   │
│  │  - TrayManager                               │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │  System Integration                          │   │
│  │  - File System (avec permissions)            │   │
│  │  - Process Spawning                          │   │
│  │  - Native Dialogs                            │   │
│  │  - Windows Registry (AutoLaunch)             │   │
│  └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

## Couches applicatives

### 1. Renderer (UI React)

**Localisation**: `apps/desktop/renderer/src/`

#### Structure
```
src/
├── app/              # Configuration app
│   ├── App.jsx       # Root component
│   ├── routes.jsx    # Router config
│   ├── layout/       # Layout components
│   │   ├── Sidebar.jsx
│   │   ├── Workspace.jsx
│   │   └── Topbar.jsx
│   └── theme/
│       └── tokens.js # Design tokens
├── pages/            # Route pages
│   ├── Login.jsx
│   ├── Home.jsx
│   ├── Tools.jsx
│   ├── Profile.jsx
│   ├── Settings.jsx
│   └── Offline.jsx
├── components/       # Composants réutilisables
│   ├── ToolCard.jsx
│   ├── SearchBar.jsx
│   ├── TagFilter.jsx
│   ├── PermissionGate.jsx
│   └── LogViewer.jsx
├── state/            # State management (Zustand)
│   └── store.js
└── api/
    └── hubApi.js     # Wrapper window.hubAPI
```

#### Responsabilités
- Affichage UI
- Routing client-side
- Gestion d'état local
- Appels API via `window.hubAPI`
- **AUCUN** accès direct Node.js/Electron

#### Patterns
- Functional components + hooks
- Zustand pour state global
- React Router v6 pour routing
- Protected routes avec auth guard

### 2. Preload (API Bridge)

**Localisation**: `apps/desktop/electron/preload/preload.js`

#### Rôle
Le preload script crée un pont sécurisé entre le Renderer et le Main process via `contextBridge`.

#### API exposée (window.hubAPI)

```javascript
window.hubAPI = {
  auth: {
    login(credentials)
    logout()
    getSession()
  },
  profile: {
    get()
    update(updates)
  },
  permissions: {
    check({ toolId, perms })
    set({ perm, enabled })
  },
  tools: {
    list()
    get(toolId)
    run({ toolId, action, payload })
    getConfig(toolId)
    setConfig({ toolId, config })
  },
  fs: {
    pickFile()
    pickFolder()
    saveFile({ defaultPath, filters })
    openPath(path)
  },
  system: {
    getStatus()
    setAutoLaunch(enabled)
    onOnlineStatus(callback)
  },
  logs: {
    tail({ type, limit })
    search(query)
  }
}
```

#### Sécurité
- Context isolation activée
- Whitelist stricte des méthodes
- Pas d'accès direct à `require()`
- Validation des inputs côté Main

### 3. Main Process

**Localisation**: `apps/desktop/electron/main/`

#### Structure
```
main/
├── main.js              # Entry point
├── tray.js              # System tray
├── autoLaunch.js        # Startup config
├── netMonitor.js        # Connectivity check
├── toolRunner.js        # Tool execution
├── permissions.js       # Permission checks
├── storage/
│   ├── index.js         # Storage manager
│   ├── jsonStore.js     # JSON persistence
│   └── sqliteStore.js   # SQLite for logs
└── security/
    ├── crypto.js        # Hash/encrypt
    └── authService.js   # Auth logic
```

#### Services principaux

##### AuthService
- Login/logout avec bcrypt
- Session management
- Token persistence (remember me)
- Password change

##### PermissionsManager
- Charge/sauvegarde profil
- Vérifie permissions par tool
- Toggle permissions
- Premium gating

##### ToolRunner
- Charge manifests depuis `tools/`
- Valide permissions avant exécution
- Exécute actions via services tools
- Gère configs par tool

##### StorageManager
- **JSON Store**: auth, profile, configs
- **SQLite Store**: action logs, historique
- Abstraction unifiée

##### NetworkMonitor
- Ping périodique (google.com)
- Émission d'événements online/offline
- Utilisé pour offline mode

##### TrayManager
- Icône système
- Menu contextuel
- Quick actions (futur)
- Minimize to tray

## Modèle de données

### Stockage local

**Emplacement**: `%APPDATA%/personal-hub/`

```
user_data/
├── auth.json           # { username, passwordHash, token }
├── profile.json        # { username, permissions[], premiumEnabled }
├── tools/
│   └── <toolId>.json   # Config par tool
├── links.json          # (V1) Liste des liens
├── logs/
│   └── app.log         # Logs texte
└── db.sqlite           # Historique actions
```

### SQLite Schema

#### Table: action_events
```sql
CREATE TABLE action_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,           -- 'auth:login', 'tool:run', etc.
  tool_id TEXT,
  payload TEXT,                 -- JSON
  status TEXT,                  -- 'success', 'error', 'blocked'
  error TEXT
);

CREATE INDEX idx_action_events_timestamp ON action_events(timestamp DESC);
CREATE INDEX idx_action_events_type ON action_events(type);
```

## Système de permissions

### Permission Types

| Permission | Description |
|-----------|-------------|
| `NET_ACCESS` | Accès internet |
| `FS_READ` | Lecture fichiers |
| `FS_WRITE` | Écriture fichiers |
| `FS_PICKER` | File/folder picker |
| `RUN_TOOL` | Exécuter services tool |
| `SPAWN_PROCESS` | Spawner subprocess |
| `CLIPBOARD` | Presse-papier |
| `NOTIFICATIONS` | Notifications Windows |
| `TRAY_CONTROL` | Contrôle tray |
| `PREMIUM_TOOLS` | Outils premium |

### Flow de vérification

1. Tool déclare permissions dans `manifest.json`
2. User toggle permissions dans Profile
3. Avant exécution: `PermissionsManager.checkPermissions()`
4. Si refus → log + erreur UI
5. Si premium requis → vérif `premiumEnabled`

### UI Feedback

- Tool card grisée si manque permissions
- Lock icon + message explicite
- Premium badge si gated
- CTA "Upgrade" (placeholder V0)

## Système de Tools

### Architecture Tool

Chaque tool est un plugin autonome dans `tools/<toolId>/`:

```
tools/youtube_downloader/
├── manifest.json       # Métadonnées
├── icon.png           # (optionnel)
├── service/
│   ├── index.js       # Export actions
│   └── *.js           # Logique métier
├── ui/
│   ├── ToolPage.jsx   # UI principale
│   └── ToolSettings.jsx
└── README.md
```

### Manifest Schema

```json
{
  "id": "youtube_downloader",
  "name": "YouTube Downloader",
  "version": "0.1.0",
  "description": "Download videos...",
  "icon": "📹",
  "tags": ["media", "download"],
  "entryRoute": "/tools/youtube",
  "requiresInternet": true,
  "permissions": ["NET_ACCESS", "FS_WRITE", "FS_PICKER", "SPAWN_PROCESS"],
  "premium": false,
  "defaultConfig": { ... }
}
```

### Service Pattern

```javascript
// tools/my_tool/service/index.js
module.exports = {
  myAction: async (payload) => {
    // Logique ici
    // Accès complet Node.js (côté Main)
    return { success: true, result: ... };
  }
};
```

### UI Pattern

```jsx
// tools/my_tool/ui/ToolPage.jsx
function MyToolPage() {
  const handleAction = async () => {
    const result = await window.hubAPI.tools.run({
      toolId: 'my_tool',
      action: 'myAction',
      payload: { ... }
    });
  };

  return <div>...</div>;
}
```

### Loading Flow

1. Au démarrage: `ToolRunner.loadTools()`
2. Lecture `tools/*/manifest.json`
3. Validation manifest
4. Require service si existe
5. Stockage en Map
6. Exposition via `hubAPI.tools.list()`

## Patterns de communication

### Renderer → Main

```javascript
// Renderer
const result = await window.hubAPI.tools.run({ ... });

// Preload (bridge)
ipcRenderer.invoke('tools:run', data)

// Main (handler)
ipcMain.handle('tools:run', async (event, data) => {
  return toolRunner.runTool(data.toolId, data.action, data.payload);
});
```

### Main → Renderer (Events)

```javascript
// Main
mainWindow.webContents.send('system:onlineStatus', isOnline);

// Preload
ipcRenderer.on('system:onlineStatus', (event, status) => callback(status))

// Renderer
hubAPI.system.onOnlineStatus((status) => {
  console.log('Online:', status);
});
```

## Sécurité

### Principes

1. **Context Isolation**: UI ne peut pas `require()` modules Node
2. **Sandbox**: Renderer sandboxé par défaut
3. **Whitelist IPC**: Seuls les channels définis sont autorisés
4. **Permission System**: Contrôle granulaire par capability
5. **Password Hashing**: bcrypt avec salt
6. **Input Validation**: Tous les inputs validés côté Main

### Threat Model

| Menace | Mitigation |
|--------|-----------|
| XSS dans UI | React escape par défaut |
| Code injection | Context isolation |
| Path traversal | Path sanitization |
| Permission bypass | Checks avant chaque action |
| Password leak | Hashing bcrypt + DPAPI (futur) |

## Performance

### Optimisations

- **Lazy loading**: Pages chargées à la demande
- **SQLite indexing**: Timestamps + types
- **Tool caching**: Manifests chargés au startup
- **React memo**: Components lourds mémoïsés
- **Vite HMR**: Dev rapide avec hot reload

### Métriques cibles (V0)

- Startup: < 3s
- Login: < 500ms
- Tool list: < 100ms
- Log tail (50): < 200ms

## Offline Mode

### Détection

1. `NetworkMonitor` ping toutes les 30s
2. `navigator.onLine` comme backup
3. Événement → UI via IPC

### Comportement

- Banner jaune en haut
- Outils nécessitant réseau: grisés
- Pages accessibles: Home, Profile, Settings, Tools offline
- Store/remote: inaccessible

## Tray & AutoLaunch

### Tray Icon

- Créé au startup
- Menu: Open / Restart / Quit
- Click → show window
- Close window → minimize to tray
- Quit via menu → vraie fermeture

### AutoLaunch

- Windows: Electron `app.setLoginItemSettings()`
- Toggle dans Settings
- Persisté dans system registry

## Build & Distribution

### Dev Mode

```bash
npm run dev
# ou
.\scripts\dev.ps1
```

- Vite dev server: `localhost:5173`
- Electron charge l'URL
- Hot reload UI
- DevTools ouvert

### Production Build

```bash
npm run build    # Build renderer
npm run dist     # Create installer
# ou
.\scripts\pack.ps1
```

- Vite build → `renderer/dist/`
- electron-builder → `dist/`
- NSIS installer pour Windows
- Includes: app + tools + data

### electron-builder Config

```json
{
  "appId": "com.personalhub.app",
  "win": {
    "target": ["nsis"]
  },
  "files": [
    "apps/desktop/electron/**/*",
    "apps/desktop/renderer/dist/**/*",
    "tools/**/*"
  ]
}
```

## Évolutions futures

### V1
- Liens avec tags + search
- Store interne (catalogue JSON)
- Download manager avec queue
- Settings UI par tool
- Historique enrichi

### V2+
- Store remote avec install
- Sync multi-machines (cloud)
- Outils Python via subprocess
- Dashboard metrics (CPU/RAM)
- Plugin marketplace

## Troubleshooting

### Problèmes courants

**Erreur: hubAPI is not available**
→ Preload script non chargé, vérifier `webPreferences`

**Permissions denied**
→ Vérifier Profile > Permissions toggles

**Tool not found**
→ Vérifier manifest.json et redémarrer

**SQLite locked**
→ Fermer app proprement (via Quit, pas kill)

**Autolaunch ne marche pas**
→ Vérifier UAC Windows, exécuter une fois en admin

## Ressources

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [React Router v6](https://reactrouter.com/)
- [Zustand](https://github.com/pmndrs/zustand)
