# Gestionnaire de tokens

Une petite application pour travailler à plusieurs sur un même fichier (typiquement un rapport
Power BI) sans outil de versionning : un "token" partagé fait office de jeton d'écriture exclusif.

- Un·e admin crée une **session** : nom, description, liste des participant·es, et une ou
  plusieurs **ressources** (les "tokens" à gérer — ex : un fichier `.pbix`).
- La session génère un **lien à partager** (`/session/<slug>`) : quiconque a le lien peut
  l'ouvrir, choisir son nom dans la liste des participant·es, puis prendre ou reposer un token.
- Prendre un token exige une **justification** ; le reposer exige une **description de ce qui a
  été fait** (comme un message de commit). Tant qu'un token est pris, personne d'autre ne peut le
  prendre, et tout le monde voit qui l'a.
- Un **historique** (qui / quoi / quand) s'affiche sous chaque session.

Il n'y a pas de compte utilisateur : l'identification se fait par simple sélection du nom dans la
liste de participant·es de la session (outil pensé pour de petites équipes internes qui se font
confiance, pas pour un usage grand public).

## Démarrer en local

```sh
npm install
cp .env.example .env   # puis éditez ADMIN_PASSWORD
npm run dev
```

Ouvrez `http://localhost:3000/admin` pour créer une session.

## Déploiement

L'app est un simple serveur Node/Express (`npm start`), sans base de données externe : les
données sont stockées dans `data/db.json` (chemin surchargeable via la variable d'environnement
`TOKEN_MANAGER_DB`). Elle se déploie comme les autres outils du site (Azure App Service,
Render, Fly.io, un VPS...), sur le même principe que `SpeechTimer` ou `Burger Quiz`.

Variables d'environnement :

| Variable         | Description                                             |
| ---------------- | -------------------------------------------------------- |
| `PORT`           | Port d'écoute (défaut `3000`)                             |
| `ADMIN_PASSWORD` | Mot de passe requis pour créer/gérer des sessions          |
| `TOKEN_MANAGER_DB` | Chemin du fichier JSON de stockage (défaut `data/db.json`) |

⚠️ `data/db.json` doit être stocké sur un disque persistant (pas un conteneur éphémère sans
volume), sous peine de perdre les sessions au redéploiement.

## Version portable

Le dossier [`../token-manager-desktop`](../token-manager-desktop) contient une version portable
(Tauri) du même frontend : un exécutable unique, sans installation, qui se connecte à un serveur
distant de votre choix (l'adresse est demandée au premier lancement). Voir son README pour la
compilation.
