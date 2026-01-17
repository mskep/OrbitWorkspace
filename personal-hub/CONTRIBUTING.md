# Contributing to Personal Hub

Merci de votre intérêt pour contribuer à Personal Hub ! Ce document vous guidera dans le processus de contribution.

## Code of Conduct

Soyez respectueux et constructif dans toutes vos interactions.

## Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé dans les issues
2. Créez une nouvelle issue avec:
   - Un titre clair et descriptif
   - Les étapes pour reproduire le bug
   - Le comportement attendu vs observé
   - Votre environnement (OS, version Node, etc.)
   - Des screenshots si pertinent

### Suggérer une fonctionnalité

1. Vérifiez que la fonctionnalité n'existe pas déjà ou n'est pas dans la roadmap
2. Créez une issue avec le tag "enhancement"
3. Décrivez clairement:
   - Le problème que ça résout
   - La solution proposée
   - Des alternatives considérées

### Contribuer du code

#### 1. Fork et clone

```bash
git clone https://github.com/votre-username/personal-hub.git
cd personal-hub
```

#### 2. Créer une branche

```bash
git checkout -b feature/ma-fonctionnalite
# ou
git checkout -b fix/mon-bug
```

#### 3. Développer

- Suivez la structure du projet (voir [ARCHITECTURE.md](ARCHITECTURE.md))
- Respectez les conventions de code
- Testez vos changements

#### 4. Commit

Messages de commit clairs et descriptifs:

```bash
git commit -m "feat: ajouter support des thèmes personnalisés"
git commit -m "fix: corriger crash au démarrage offline"
git commit -m "docs: améliorer documentation API"
```

Conventions:
- `feat`: nouvelle fonctionnalité
- `fix`: correction de bug
- `docs`: documentation
- `style`: formatage, point-virgules manquants
- `refactor`: refactoring sans changement fonctionnel
- `test`: ajout de tests
- `chore`: tâches de maintenance

#### 5. Push et Pull Request

```bash
git push origin feature/ma-fonctionnalite
```

Créez une Pull Request avec:
- Un titre clair
- Une description détaillée des changements
- Des screenshots si UI
- La référence à l'issue concernée

## Structure du projet

Consultez [ARCHITECTURE.md](ARCHITECTURE.md) pour comprendre:
- L'architecture des processus
- Le système de permissions
- Le modèle de tools
- Les patterns de communication

## Conventions de code

### JavaScript/JSX

- Pas de TypeScript pour ce projet (décision du projet)
- Indentation: 2 espaces
- Quotes: simples `'` pour strings
- Semicolons: utilisés
- React: functional components + hooks

### CSS

- Convention BEM ou similaire
- Variables dans `theme/tokens.js`
- Mobile-first (futur)

### Nommage

- **Fichiers**: PascalCase pour composants React (`MyComponent.jsx`)
- **Variables**: camelCase (`myVariable`)
- **Constantes**: UPPER_SNAKE_CASE (`MY_CONSTANT`)
- **Fonctions**: camelCase (`doSomething`)

## Créer un nouveau Tool

Voir [QUICKSTART.md](QUICKSTART.md#créer-votre-premier-outil) pour un guide complet.

Structure minimale:
```
tools/mon_outil/
├── manifest.json
├── service/
│   └── index.js
├── ui/
│   └── ToolPage.jsx
└── README.md
```

## Tests

Pour le moment, pas de tests automatisés (V0). Les tests manuels sont requis:

1. Lancer en dev: `npm run dev`
2. Tester la fonctionnalité
3. Tester le mode offline
4. Tester les permissions
5. Tester le build: `npm run build && npm run pack`

## Documentation

Toute PR doit inclure:
- Mise à jour du README.md si nécessaire
- Commentaires dans le code pour la logique complexe
- Mise à jour de CHANGELOG.md

## Questions

Si vous avez des questions:
1. Consultez la documentation existante
2. Recherchez dans les issues fermées
3. Créez une nouvelle issue avec le tag "question"

## Licence

En contribuant, vous acceptez que vos contributions soient sous la même licence MIT que le projet.

Merci ! 🙏
