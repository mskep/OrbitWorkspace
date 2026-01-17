# 📚 Personal Hub - Index de documentation

Bienvenue dans Personal Hub ! Ce fichier vous guide vers la bonne documentation selon vos besoins.

## 🚀 Je veux démarrer rapidement

➡️ **[QUICKSTART.md](QUICKSTART.md)**
- Installation en 5 minutes
- Premier lancement
- Création de votre premier outil
- Commandes essentielles

## 📖 Je veux comprendre le projet

➡️ **[README.md](README.md)**
- Vue d'ensemble du projet
- Fonctionnalités principales
- Structure du projet
- Roadmap V1/V2

## 🏗️ Je veux comprendre l'architecture

➡️ **[ARCHITECTURE.md](ARCHITECTURE.md)**
- Architecture des processus (Main/Renderer/Preload)
- Système de permissions détaillé
- Modèle de données
- Patterns de communication
- Sécurité

## 🔌 Je développe un outil et besoin de l'API

➡️ **[API.md](API.md)**
- Référence complète de `window.hubAPI`
- Exemples de code
- Gestion d'erreurs
- Bonnes pratiques

## 🤝 Je veux contribuer

➡️ **[CONTRIBUTING.md](CONTRIBUTING.md)**
- Comment signaler un bug
- Comment proposer une fonctionnalité
- Conventions de code
- Process de Pull Request

## 📋 Je veux voir l'historique

➡️ **[CHANGELOG.md](CHANGELOG.md)**
- Versions publiées
- Fonctionnalités ajoutées
- Bugs corrigés
- Roadmap

## ✅ Je veux voir le statut du projet

➡️ **[PROJECT_STATUS.md](PROJECT_STATUS.md)**
- État d'avancement V0
- Checklist des fonctionnalités
- Statistiques du projet
- Next steps

## 📂 Navigation par besoin

### Installation & Setup
1. [QUICKSTART.md](QUICKSTART.md) - Installation
2. [README.md](README.md#getting-started) - Prerequisites
3. [PROJECT_STATUS.md](PROJECT_STATUS.md#-checklist-de-démarrage) - Checklist

### Développement d'outils
1. [QUICKSTART.md](QUICKSTART.md#créer-votre-premier-outil) - Créer un outil
2. [API.md](API.md) - API disponible
3. [ARCHITECTURE.md](ARCHITECTURE.md#système-de-tools) - Architecture tools
4. Exemples:
   - [tools/youtube_downloader/](tools/youtube_downloader/)
   - [tools/pdf_tools/](tools/pdf_tools/)

### Comprendre le code
1. [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture complète
2. [API.md](API.md) - Contrats API
3. [apps/desktop/electron/main/](apps/desktop/electron/main/) - Backend
4. [apps/desktop/renderer/src/](apps/desktop/renderer/src/) - Frontend

### Contribution
1. [CONTRIBUTING.md](CONTRIBUTING.md) - Guide complet
2. [CHANGELOG.md](CHANGELOG.md) - Format des versions
3. [LICENSE](LICENSE) - Licence MIT

### Troubleshooting
1. [QUICKSTART.md](QUICKSTART.md#résolution-de-problèmes) - Problèmes courants
2. [ARCHITECTURE.md](ARCHITECTURE.md#troubleshooting) - Debug avancé

## 🗂️ Structure de fichiers

```
personal-hub/
├── 📘 INDEX.md                 👈 Vous êtes ici !
├── 📗 README.md                Vue d'ensemble
├── 📙 QUICKSTART.md            Guide rapide
├── 📕 ARCHITECTURE.md          Doc technique
├── 📔 API.md                   Référence API
├── 📓 CONTRIBUTING.md          Contribution
├── 📒 CHANGELOG.md             Historique
├── ✅ PROJECT_STATUS.md        Status V0
│
├── apps/                       Code source
│   └── desktop/
│       ├── electron/
│       │   ├── main/           Backend (Node.js)
│       │   ├── preload/        API Bridge
│       │   └── shared/         Constantes
│       └── renderer/
│           └── src/            Frontend (React)
│
├── tools/                      Plugins
│   ├── youtube_downloader/
│   └── pdf_tools/
│
└── scripts/                    Build scripts
    ├── dev.ps1
    ├── build.ps1
    └── pack.ps1
```

## 🎓 Parcours d'apprentissage

### Niveau 1: Utilisateur
1. Lire [README.md](README.md) - Comprendre le projet
2. Suivre [QUICKSTART.md](QUICKSTART.md) - Installation
3. Explorer l'interface
4. Tester les outils exemple

### Niveau 2: Créateur d'outils
1. Lire [API.md](API.md) - Comprendre l'API
2. Suivre [QUICKSTART.md#créer-votre-premier-outil](QUICKSTART.md#créer-votre-premier-outil)
3. Étudier `tools/youtube_downloader/`
4. Créer votre propre outil

### Niveau 3: Contributeur
1. Lire [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture complète
2. Lire [CONTRIBUTING.md](CONTRIBUTING.md) - Process
3. Explorer le code source
4. Proposer des améliorations

### Niveau 4: Mainteneur
1. Tout ce qui précède
2. Comprendre le build process
3. Gérer les issues et PR
4. Maintenir la documentation

## 🔍 Recherche rapide

| Je cherche... | Document |
|--------------|----------|
| Comment installer | [QUICKSTART.md](QUICKSTART.md) |
| Comment utiliser l'API | [API.md](API.md) |
| Comment fonctionne X | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Comment contribuer | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Quelle version | [CHANGELOG.md](CHANGELOG.md) |
| Status du projet | [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| Vue d'ensemble | [README.md](README.md) |

## 💡 Cas d'usage courants

### "Je veux juste essayer l'app"
1. [QUICKSTART.md](QUICKSTART.md) → Section installation
2. `npm install && npm run dev`
3. Login: admin/admin

### "Je veux créer un outil pour télécharger des fichiers"
1. [QUICKSTART.md](QUICKSTART.md) → Créer votre premier outil
2. [API.md](API.md) → Section Filesystem
3. Exemple: `tools/youtube_downloader/`

### "Je veux comprendre les permissions"
1. [ARCHITECTURE.md](ARCHITECTURE.md) → Système de permissions
2. [API.md](API.md) → Section Permissions
3. Code: [apps/desktop/electron/main/permissions.js](apps/desktop/electron/main/permissions.js)

### "Je veux ajouter une nouvelle page"
1. [ARCHITECTURE.md](ARCHITECTURE.md) → Renderer
2. Exemple: [apps/desktop/renderer/src/pages/Home.jsx](apps/desktop/renderer/src/pages/Home.jsx)
3. Ajouter route dans [apps/desktop/renderer/src/app/routes.jsx](apps/desktop/renderer/src/app/routes.jsx)

### "Je veux modifier le thème"
1. [apps/desktop/renderer/styles/app.css](apps/desktop/renderer/styles/app.css)
2. [apps/desktop/renderer/src/app/theme/tokens.js](apps/desktop/renderer/src/app/theme/tokens.js)

## 📞 Où poser des questions

1. **Questions techniques**: Issues GitHub
2. **Questions d'usage**: [QUICKSTART.md](QUICKSTART.md) puis Issues
3. **Bugs**: [CONTRIBUTING.md](CONTRIBUTING.md) → Signaler un bug

## 🎯 Quick Links

### Documentation
- [📗 README](README.md) - Start here
- [📙 Quick Start](QUICKSTART.md) - 5min setup
- [📕 Architecture](ARCHITECTURE.md) - Deep dive
- [📔 API Reference](API.md) - For developers

### Code
- [Main Process](apps/desktop/electron/main/)
- [Renderer (React)](apps/desktop/renderer/src/)
- [Preload Bridge](apps/desktop/electron/preload/)
- [Example Tools](tools/)

### Meta
- [✅ Status V0](PROJECT_STATUS.md)
- [📒 Changelog](CHANGELOG.md)
- [🤝 Contributing](CONTRIBUTING.md)
- [⚖️ License](LICENSE)

---

**Astuce**: Utilisez Ctrl+F dans cette page pour rechercher rapidement un sujet !

**Besoin d'aide ?** Commencez par [QUICKSTART.md](QUICKSTART.md) puis [README.md](README.md)

Bonne exploration ! 🚀
