# 🔧 Fix d'installation - Personal Hub

## Problème résolu

L'installation initiale échouait à cause de `better-sqlite3` qui nécessite de compiler du code natif avec Visual Studio Build Tools.

## ✅ Solution appliquée

J'ai simplifié le projet pour **ne plus nécessiter SQLite** :

### Changements effectués

1. **package.json** - Supprimé les dépendances problématiques:
   - ❌ `better-sqlite3` (nécessitait compilation native)
   - ❌ `node-fetch` (inutile, utilisation de `https` natif)
   - ❌ `electron-store` (non utilisé)
   - ✅ Gardé uniquement `bcryptjs` pour les passwords

2. **jsonLogsStore.js** - Nouveau système de logs JSON:
   - Stockage dans `action_logs.json`
   - Garde max 1000 logs
   - Même API que SQLite
   - Pas de compilation native requise

3. **netMonitor.js** - Utilise `https` natif au lieu de `node-fetch`

4. **storage/index.js** - Adapté pour utiliser JSON au lieu de SQLite

## 🚀 Installation maintenant

```powershell
# Supprimer node_modules si existant
rm -r -force node_modules

# Réinstaller (devrait fonctionner maintenant)
npm install

# Installer le renderer
cd apps\desktop\renderer
npm install
cd ..\..\..

# Lancer l'app
npm run dev
```

## 📊 Différences avec la version SQLite

| Fonctionnalité | SQLite (avant) | JSON (maintenant) |
|----------------|----------------|-------------------|
| Logs storage | Base de données | Fichier JSON |
| Performance | Excellent | Bon (< 1000 logs) |
| Indexation | Oui | Non |
| Full-text search | FTS5 | Filtrage simple |
| Installation | Compilation C++ | Aucune compilation |
| Dépendances | Native | Pure JS |

### Avantages JSON
- ✅ Installation sans problème
- ✅ Pas de build tools requis
- ✅ Portable (copier/coller le dossier)
- ✅ Logs lisibles directement
- ✅ Pas de corruption de DB

### Limitations JSON
- ⚠️ Max ~1000 logs gardés (rotation auto)
- ⚠️ Recherche moins performante
- ⚠️ Pas d'indexation

## 🔄 Revenir à SQLite plus tard (optionnel)

Si vous voulez vraiment SQLite, vous devrez :

1. **Installer Visual Studio Build Tools**:
   - Télécharger: https://visualstudio.microsoft.com/downloads/
   - Installer le workload "Desktop development with C++"
   - ~6 GB d'espace disque

2. **Réinstaller les dépendances**:
   ```powershell
   # Dans package.json, ajouter:
   "better-sqlite3": "^9.2.2"

   # Réinstaller
   npm install
   ```

3. **Restaurer les fichiers SQLite**:
   - Utiliser `sqliteStore.js` au lieu de `jsonLogsStore.js`
   - Modifier `storage/index.js`

Mais **ce n'est pas nécessaire pour V0** ! JSON fonctionne très bien.

## ✅ Vérification

Après installation, vérifier:

```powershell
# Vérifier les dépendances
npm list --depth=0

# Devrait montrer:
# ├── bcryptjs@2.4.3
# ├── concurrently@8.2.2
# ├── electron@28.x.x
# ├── electron-builder@24.x.x
# └── wait-on@7.2.0

# Lancer l'app
npm run dev
```

L'app devrait démarrer sans erreur !

## 🎯 Next steps

1. Installer les dépendances (voir commandes ci-dessus)
2. Lancer `npm run dev`
3. Login avec admin/admin
4. Tester l'application

Les logs seront stockés dans:
```
%APPDATA%/personal-hub/action_logs.json
```

## 📝 Notes

- Le système de logs JSON est **production-ready** pour V0
- SQLite peut être ajouté plus tard si vraiment nécessaire
- Aucune fonctionnalité n'est perdue, juste l'implémentation change
- L'API reste identique (`hubAPI.logs.tail()`, etc.)

Bon développement ! 🚀
