# Personal Hub API Reference

Documentation complète de l'API `window.hubAPI` disponible pour les outils et l'interface utilisateur.

## Table des matières

- [Authentication](#authentication)
- [Profile](#profile)
- [Permissions](#permissions)
- [Tools](#tools)
- [Filesystem](#filesystem)
- [System](#system)
- [Logs](#logs)

---

## Authentication

### `auth.login(credentials)`

Authentifie un utilisateur.

**Paramètres:**
```javascript
{
  username: string,      // Nom d'utilisateur
  password: string,      // Mot de passe
  rememberMe: boolean    // Sauvegarder la session (optionnel)
}
```

**Retour:**
```javascript
{
  success: boolean,
  session?: {
    username: string,
    token: string,
    loginTime: number
  },
  error?: string
}
```

**Exemple:**
```javascript
const result = await window.hubAPI.auth.login({
  username: 'admin',
  password: 'admin',
  rememberMe: true
});

if (result.success) {
  console.log('Logged in:', result.session);
}
```

### `auth.logout()`

Déconnecte l'utilisateur actuel.

**Retour:**
```javascript
{
  success: boolean
}
```

**Exemple:**
```javascript
await window.hubAPI.auth.logout();
```

### `auth.getSession()`

Récupère la session actuelle.

**Retour:**
```javascript
{
  username: string,
  token: string,
  loginTime: number
} | null
```

**Exemple:**
```javascript
const session = await window.hubAPI.auth.getSession();
if (session) {
  console.log('Current user:', session.username);
}
```

---

## Profile

### `profile.get()`

Récupère le profil de l'utilisateur.

**Retour:**
```javascript
{
  username: string,
  permissions: string[],    // Liste des permissions activées
  premiumEnabled: boolean,
  createdAt: number
}
```

**Exemple:**
```javascript
const profile = await window.hubAPI.profile.get();
console.log('Permissions:', profile.permissions);
```

### `profile.update(updates)`

Met à jour le profil.

**Paramètres:**
```javascript
{
  // Tout champ du profil peut être mis à jour
  username?: string,
  premiumEnabled?: boolean,
  // Note: permissions se gèrent via permissions.set()
}
```

**Retour:**
```javascript
{
  // Profil mis à jour
  username: string,
  permissions: string[],
  premiumEnabled: boolean,
  createdAt: number
}
```

**Exemple:**
```javascript
await window.hubAPI.profile.update({
  premiumEnabled: true
});
```

---

## Permissions

### `permissions.check({ toolId, perms })`

Vérifie si les permissions sont accordées pour un outil.

**Paramètres:**
```javascript
{
  toolId: string,        // ID de l'outil
  perms: string[]        // Liste des permissions requises
}
```

**Retour:**
```javascript
{
  allowed: boolean,
  missingPermissions: string[]
}
```

**Exemple:**
```javascript
const check = await window.hubAPI.permissions.check({
  toolId: 'youtube_downloader',
  perms: ['NET_ACCESS', 'FS_WRITE']
});

if (!check.allowed) {
  console.log('Missing:', check.missingPermissions);
}
```

### `permissions.set({ perm, enabled })`

Active ou désactive une permission.

**Paramètres:**
```javascript
{
  perm: string,          // Nom de la permission
  enabled: boolean       // Activer ou désactiver
}
```

**Retour:**
```javascript
{
  // Profil mis à jour
  username: string,
  permissions: string[],
  premiumEnabled: boolean,
  createdAt: number
}
```

**Exemple:**
```javascript
await window.hubAPI.permissions.set({
  perm: 'NET_ACCESS',
  enabled: true
});
```

---

## Tools

### `tools.list()`

Liste tous les outils disponibles.

**Retour:**
```javascript
[
  {
    id: string,
    name: string,
    version: string,
    description: string,
    icon: string,
    tags: string[],
    entryRoute: string,
    requiresInternet: boolean,
    permissions: string[],
    premium: boolean,
    accessible: boolean,           // true si non-premium OU user premium
    permissionsGranted: boolean,   // true si toutes permissions OK
    missingPermissions: string[]
  },
  // ...
]
```

**Exemple:**
```javascript
const tools = await window.hubAPI.tools.list();
const availableTools = tools.filter(t => t.accessible && t.permissionsGranted);
```

### `tools.get(toolId)`

Récupère les détails d'un outil.

**Paramètres:**
- `toolId` (string): ID de l'outil

**Retour:**
```javascript
{
  id: string,
  name: string,
  version: string,
  description: string,
  icon: string,
  tags: string[],
  entryRoute: string,
  requiresInternet: boolean,
  permissions: string[],
  premium: boolean,
  accessible: boolean,
  permissionsGranted: boolean,
  missingPermissions: string[]
} | null
```

**Exemple:**
```javascript
const tool = await window.hubAPI.tools.get('youtube_downloader');
if (tool && tool.accessible) {
  console.log('Tool available:', tool.name);
}
```

### `tools.run({ toolId, action, payload })`

Exécute une action d'un outil.

**Paramètres:**
```javascript
{
  toolId: string,        // ID de l'outil
  action: string,        // Nom de l'action dans le service
  payload: object        // Données à passer à l'action
}
```

**Retour:**
```javascript
{
  success: boolean,
  result?: any,              // Résultat retourné par le service
  error?: string,
  missingPermissions?: string[]
}
```

**Exemple:**
```javascript
const result = await window.hubAPI.tools.run({
  toolId: 'youtube_downloader',
  action: 'download',
  payload: {
    url: 'https://youtube.com/watch?v=...',
    outputPath: 'C:/Downloads'
  }
});

if (result.success) {
  console.log('Downloaded:', result.result);
} else {
  console.error('Error:', result.error);
}
```

### `tools.getConfig(toolId)`

Récupère la configuration d'un outil.

**Paramètres:**
- `toolId` (string): ID de l'outil

**Retour:**
```javascript
{
  // Configuration spécifique à l'outil
  // Définie par tool.manifest.defaultConfig
}
```

**Exemple:**
```javascript
const config = await window.hubAPI.tools.getConfig('youtube_downloader');
console.log('Download path:', config.downloadPath);
```

### `tools.setConfig({ toolId, config })`

Met à jour la configuration d'un outil.

**Paramètres:**
```javascript
{
  toolId: string,
  config: object    // Fusion avec la config existante
}
```

**Retour:**
```javascript
{
  // Configuration complète mise à jour
}
```

**Exemple:**
```javascript
await window.hubAPI.tools.setConfig({
  toolId: 'youtube_downloader',
  config: {
    downloadPath: 'D:/Videos',
    format: 'mp4'
  }
});
```

---

## Filesystem

### `fs.pickFile()`

Ouvre un dialogue de sélection de fichier.

**Permissions requises:** `FS_PICKER`

**Retour:**
```javascript
string | null    // Chemin du fichier sélectionné, ou null si annulé
```

**Exemple:**
```javascript
const filePath = await window.hubAPI.fs.pickFile();
if (filePath) {
  console.log('Selected:', filePath);
}
```

### `fs.pickFolder()`

Ouvre un dialogue de sélection de dossier.

**Permissions requises:** `FS_PICKER`

**Retour:**
```javascript
string | null    // Chemin du dossier sélectionné, ou null si annulé
```

**Exemple:**
```javascript
const folderPath = await window.hubAPI.fs.pickFolder();
if (folderPath) {
  console.log('Selected folder:', folderPath);
}
```

### `fs.saveFile({ defaultPath, filters })`

Ouvre un dialogue de sauvegarde.

**Permissions requises:** `FS_PICKER`, `FS_WRITE`

**Paramètres:**
```javascript
{
  defaultPath?: string,     // Nom de fichier par défaut
  filters?: Array<{
    name: string,           // Ex: "Images"
    extensions: string[]    // Ex: ["jpg", "png"]
  }>
}
```

**Retour:**
```javascript
string | null    // Chemin où sauvegarder, ou null si annulé
```

**Exemple:**
```javascript
const savePath = await window.hubAPI.fs.saveFile({
  defaultPath: 'video.mp4',
  filters: [
    { name: 'Videos', extensions: ['mp4', 'avi'] },
    { name: 'All Files', extensions: ['*'] }
  ]
});

if (savePath) {
  // Sauvegarder le fichier à savePath
}
```

### `fs.openPath(path)`

Ouvre un fichier ou dossier dans l'explorateur Windows.

**Paramètres:**
- `path` (string): Chemin à ouvrir

**Retour:**
```javascript
{
  success: boolean
}
```

**Exemple:**
```javascript
await window.hubAPI.fs.openPath('C:/Users/Downloads');
```

---

## System

### `system.getStatus()`

Récupère le statut du système.

**Retour:**
```javascript
{
  online: boolean,
  appVersion: string,
  platform: string,
  autoLaunchEnabled: boolean
}
```

**Exemple:**
```javascript
const status = await window.hubAPI.system.getStatus();
console.log('App version:', status.appVersion);
console.log('Online:', status.online);
```

### `system.setAutoLaunch(enabled)`

Active ou désactive le lancement au démarrage.

**Paramètres:**
- `enabled` (boolean): true pour activer, false pour désactiver

**Retour:**
```javascript
boolean    // true si réussi
```

**Exemple:**
```javascript
await window.hubAPI.system.setAutoLaunch(true);
console.log('Auto-launch enabled');
```

### `system.onOnlineStatus(callback)`

S'abonne aux changements d'état réseau.

**Paramètres:**
- `callback` (function): `(isOnline: boolean) => void`

**Retour:**
- void

**Exemple:**
```javascript
window.hubAPI.system.onOnlineStatus((isOnline) => {
  if (isOnline) {
    console.log('Connection restored');
  } else {
    console.log('Connection lost');
  }
});
```

---

## Logs

### `logs.tail({ type, limit })`

Récupère les derniers logs.

**Paramètres:**
```javascript
{
  type?: string,     // Filtrer par type (optionnel)
  limit?: number     // Nombre max de logs (défaut: 50)
}
```

**Retour:**
```javascript
[
  {
    id: number,
    timestamp: number,
    type: string,            // 'auth:login', 'tool:run', etc.
    tool_id: string | null,
    payload: string | null,  // JSON stringifié
    status: string,          // 'success', 'error', 'blocked'
    error: string | null
  },
  // ...
]
```

**Exemple:**
```javascript
const logs = await window.hubAPI.logs.tail({ limit: 20 });
logs.forEach(log => {
  console.log(`[${new Date(log.timestamp).toLocaleString()}] ${log.type}: ${log.status}`);
});
```

### `logs.search(query)`

Recherche dans les logs.

**Paramètres:**
- `query` (string): Texte à rechercher

**Retour:**
```javascript
[
  {
    id: number,
    timestamp: number,
    type: string,
    tool_id: string | null,
    payload: string | null,
    status: string,
    error: string | null
  },
  // ... (max 100 résultats)
]
```

**Exemple:**
```javascript
const results = await window.hubAPI.logs.search('youtube');
console.log(`Found ${results.length} logs mentioning youtube`);
```

---

## Types de permissions

| Permission | Description |
|-----------|-------------|
| `NET_ACCESS` | Accès réseau/internet |
| `FS_READ` | Lecture fichiers |
| `FS_WRITE` | Écriture fichiers |
| `FS_PICKER` | Dialogues picker |
| `RUN_TOOL` | Exécuter services outils |
| `SPAWN_PROCESS` | Spawner processus externes |
| `CLIPBOARD` | Presse-papier |
| `NOTIFICATIONS` | Notifications Windows |
| `TRAY_CONTROL` | Contrôle du tray |
| `PREMIUM_TOOLS` | Outils premium |

## Gestion d'erreurs

Toutes les fonctions API peuvent lever des exceptions. Utilisez try/catch:

```javascript
try {
  const result = await window.hubAPI.tools.run({ ... });
  if (!result.success) {
    // Gérer l'erreur métier
    console.error('Tool error:', result.error);
  }
} catch (error) {
  // Gérer l'erreur système
  console.error('System error:', error);
}
```

## Bonnes pratiques

1. **Toujours vérifier les permissions** avant d'appeler une fonction sensible
2. **Gérer les cas offline** pour les outils nécessitant internet
3. **Logger les actions importantes** pour l'audit
4. **Valider les inputs** côté UI avant d'appeler l'API
5. **Afficher des messages clairs** à l'utilisateur en cas d'erreur

## Exemple complet : Tool UI

```jsx
import React, { useState, useEffect } from 'react';

function MyToolPage() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Check permissions
    checkPermissions();

    // Listen to online status
    window.hubAPI.system.onOnlineStatus(setIsOnline);

    // Get initial status
    loadStatus();
  }, []);

  async function checkPermissions() {
    const check = await window.hubAPI.permissions.check({
      toolId: 'my_tool',
      perms: ['NET_ACCESS', 'FS_WRITE']
    });
    setHasPermission(check.allowed);
  }

  async function loadStatus() {
    const status = await window.hubAPI.system.getStatus();
    setIsOnline(status.online);
  }

  async function handleAction() {
    if (!hasPermission) {
      alert('Missing permissions');
      return;
    }

    if (!isOnline) {
      alert('This tool requires internet connection');
      return;
    }

    try {
      const res = await window.hubAPI.tools.run({
        toolId: 'my_tool',
        action: 'myAction',
        payload: { /* ... */ }
      });

      if (res.success) {
        setResult(res.result);
      } else {
        alert('Error: ' + res.error);
      }
    } catch (error) {
      alert('System error: ' + error.message);
    }
  }

  if (!hasPermission) {
    return <div>Missing permissions. Please enable in Profile.</div>;
  }

  return (
    <div>
      <h2>My Tool</h2>
      {!isOnline && <div className="warning">Offline mode</div>}
      <button onClick={handleAction} disabled={!isOnline}>
        Run Action
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

export default MyToolPage;
```

---

Pour plus d'informations, consultez:
- [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture détaillée
- [QUICKSTART.md](QUICKSTART.md) - Guide de démarrage
- [README.md](README.md) - Vue d'ensemble
