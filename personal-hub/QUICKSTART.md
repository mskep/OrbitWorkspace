# Quick Start Guide - Personal Hub

## Installation rapide

### 1. Prérequis

Assurez-vous d'avoir installé:
- Node.js 18+ ([télécharger](https://nodejs.org/))
- npm (inclus avec Node.js)
- Windows 10/11

Vérification:
```powershell
node --version   # devrait afficher v18.x ou plus
npm --version    # devrait afficher 9.x ou plus
```

### 2. Installation des dépendances

```powershell
# À la racine du projet
cd personal-hub

# Installer les dépendances principales
npm install

# Installer les dépendances du renderer
cd apps/desktop/renderer
npm install
cd ../../..
```

### 3. Lancement en développement

**Option A - Via npm:**
```powershell
npm run dev
```

**Option B - Via PowerShell script:**
```powershell
.\scripts\dev.ps1
```

L'application devrait s'ouvrir automatiquement.

### 4. Connexion

Utilisez les identifiants par défaut:
- **Username**: `admin`
- **Password**: `admin`

> **Note**: Changez le mot de passe après la première connexion (fonctionnalité à venir en V1)

## Navigation

### Pages disponibles

1. **Accueil** 🏠
   - Dashboard avec status système
   - Activité récente
   - Quick actions

2. **Outils** 🔧
   - Liste des outils disponibles
   - Filtres par tags
   - Recherche

3. **Liens** 🔗
   - (Placeholder V0, implémenté en V1)

4. **Store** 🛍️
   - (Placeholder V0, catalogue V1)

5. **Profil** 👤
   - Informations utilisateur
   - Toggles permissions
   - Status premium

6. **Settings** ⚙️
   - Auto-launch configuration
   - Informations système
   - Logs viewer

## Tester les outils

### YouTube Downloader

1. Aller dans **Outils**
2. Cliquer sur "YouTube Downloader"
3. Entrer une URL YouTube
4. Cliquer "Download"

> **Note**: C'est un placeholder. Pour un vrai téléchargement, installez `yt-dlp` et modifiez `tools/youtube_downloader/service/downloader.js`

### PDF Tools

1. Aller dans **Outils**
2. Cliquer sur "PDF Tools"
3. Interface à implémenter selon vos besoins

## Tester les permissions

1. Aller dans **Profil**
2. Désactiver une permission (ex: `FS_WRITE`)
3. Retourner dans **Outils**
4. Les outils nécessitant cette permission seront verrouillés 🔒

## Tester le mode offline

1. Désactiver votre connexion internet
2. L'app devrait afficher un banner orange "Offline"
3. Les outils nécessitant internet sont grisés
4. Navigation reste possible

## Tester le tray

1. Fermer la fenêtre (X)
2. L'app se minimise dans le system tray
3. Clic droit sur l'icône → "Open Personal Hub"
4. Pour quitter: Clic droit → "Quit"

## Créer votre premier outil

### 1. Créer la structure

```powershell
mkdir tools/my_tool
mkdir tools/my_tool/service
mkdir tools/my_tool/ui
```

### 2. Créer le manifest

`tools/my_tool/manifest.json`:
```json
{
  "id": "my_tool",
  "name": "My Custom Tool",
  "version": "0.1.0",
  "description": "Mon outil personnalisé",
  "icon": "⚡",
  "tags": ["utility", "custom"],
  "entryRoute": "/tools/my_tool",
  "requiresInternet": false,
  "permissions": ["FS_READ"],
  "premium": false,
  "defaultConfig": {}
}
```

### 3. Créer le service

`tools/my_tool/service/index.js`:
```javascript
module.exports = {
  hello: async (payload) => {
    console.log('Hello from my tool!', payload);
    return {
      success: true,
      message: `Hello ${payload.name}!`
    };
  }
};
```

### 4. Créer l'UI

`tools/my_tool/ui/ToolPage.jsx`:
```jsx
import React, { useState } from 'react';

function MyToolPage() {
  const [result, setResult] = useState('');

  const handleClick = async () => {
    const res = await window.hubAPI.tools.run({
      toolId: 'my_tool',
      action: 'hello',
      payload: { name: 'World' }
    });

    if (res.success) {
      setResult(res.result.message);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>My Custom Tool</h2>
      <button onClick={handleClick}>Say Hello</button>
      {result && <p>{result}</p>}
    </div>
  );
}

export default MyToolPage;
```

### 5. Redémarrer l'app

```powershell
# Arrêter (Ctrl+C)
# Relancer
npm run dev
```

Votre outil apparaît dans la liste des outils ! 🎉

## Commandes utiles

### Développement
```powershell
npm run dev              # Lancer en dev
npm run dev:renderer     # Juste le renderer (Vite)
npm run dev:electron     # Juste Electron
```

### Build
```powershell
npm run build            # Build complet
npm run build:renderer   # Build juste le renderer
npm run pack             # Package sans installer
npm run dist             # Créer installateur Windows
```

### Scripts PowerShell
```powershell
.\scripts\dev.ps1        # Développement
.\scripts\build.ps1      # Build
.\scripts\pack.ps1       # Package complet
```

## Résolution de problèmes

### L'app ne démarre pas

1. Vérifier que les dépendances sont installées:
```powershell
npm install
cd apps/desktop/renderer && npm install
```

2. Vérifier les ports (5173 doit être libre):
```powershell
netstat -ano | findstr :5173
```

3. Supprimer node_modules et réinstaller:
```powershell
rm -r node_modules
rm -r apps/desktop/renderer/node_modules
npm install
cd apps/desktop/renderer && npm install
```

### Erreur "hubAPI is not available"

Le preload script n'est pas chargé. Vérifier [main.js:15-19](apps/desktop/electron/main/main.js#L15-L19):
```javascript
webPreferences: {
  preload: path.join(__dirname, '../preload/preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

### Les outils n'apparaissent pas

1. Vérifier que `manifest.json` est valide (JSON correct)
2. Redémarrer l'app
3. Vérifier les logs dans la console DevTools (F12)

### Auto-launch ne fonctionne pas

1. Lancer l'app en tant qu'administrateur (une fois)
2. Activer dans Settings
3. Redémarrer Windows

## Prochaines étapes

1. **Personnaliser le style**
   - Modifier [app.css](apps/desktop/renderer/styles/app.css)
   - Ajuster [tokens.js](apps/desktop/renderer/src/app/theme/tokens.js)

2. **Créer vos outils**
   - Suivre le pattern dans `tools/`
   - Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour détails

3. **Ajouter des fonctionnalités**
   - Liens (V1)
   - Store (V1)
   - Download manager (V1)

4. **Contribuer**
   - Lire [README.md](README.md)
   - Voir roadmap V1/V2

## Ressources

- [README.md](README.md) - Vue d'ensemble complète
- [ARCHITECTURE.md](ARCHITECTURE.md) - Documentation technique
- [tools/youtube_downloader/](tools/youtube_downloader/) - Exemple outil complet

## Support

En cas de problème:
1. Vérifier les logs dans la console DevTools (F12)
2. Consulter [ARCHITECTURE.md](ARCHITECTURE.md)
3. Vérifier les issues GitHub

Bon développement ! 🚀
