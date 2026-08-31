# Gestionnaire de tokens

Une petite application pour travailler à plusieurs sur un même fichier (typiquement un rapport
Power BI) sans outil de versionning : un "token" partagé fait office de jeton d'écriture exclusif.

- N'importe qui peut se créer un compte dans **son espace** (`/espace`) et y créer une
  **session** : nom, description, liste des participant·es, et une ou plusieurs **ressources**
  (les "tokens" à gérer — ex : un fichier `.pbix`). Ses sessions ne sont visibles que par lui/elle.
- La session génère un **lien à partager** (`/session/<slug>`) : quiconque a le lien peut
  l'ouvrir, choisir son nom dans la liste des participant·es, puis prendre ou reposer un token —
  sans avoir besoin de compte.
- Prendre un token exige une **justification** ; le reposer exige une **description de ce qui a
  été fait** (comme un message de commit). Tant qu'un token est pris, personne d'autre ne peut le
  prendre, et tout le monde voit qui l'a.
- Un **historique** (qui / quoi / quand) s'affiche sous chaque session.
- Chaque session a une **date de suppression automatique** (365 jours par défaut, réglable à la
  création, 0 = jamais), affichée dans toutes les vues. Un balayage périodique (toutes les 15 min)
  supprime les sessions expirées côté serveur ; seul·e l'**administrateur·rice du site** peut
  modifier cette date après coup (voir plus bas) — cela évite d'avoir à nettoyer les sessions des
  autres à la main.

## Deux niveaux d'accès

- **Espace créateur·rice** (`/espace`, compte nom d'utilisateur + mot de passe, auto-inscription) :
  chacun·e ne voit et ne gère que **ses propres** sessions — jamais celles des autres créateur·rices.
  C'est l'espace normal pour monter une session d'équipe.
- **Administration du site** (`/admin`, protégée par `ADMIN_PASSWORD`) : réservée à la personne qui
  opère le déploiement. Vue d'ensemble sur tous les comptes créateur·rices et toutes les sessions
  (qui utilise l'outil), avec suppression possible de n'importe quel compte ou session. L'admin du
  site ne crée pas de session lui/elle-même depuis cet espace — il/elle supervise seulement.

Les participant·es d'une session (ceux qui reçoivent juste le lien `/session/...`) n'ont besoin
d'aucun compte : ils choisissent leur nom dans la liste de participant·es de la session.

## Démarrer en local

```sh
npm install
cp .env.example .env   # puis éditez ADMIN_PASSWORD
npm run dev
```

Ouvrez `http://localhost:3000/espace` pour créer un compte et une session, ou
`http://localhost:3000/admin` (avec `ADMIN_PASSWORD`) pour la supervision du site.

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
(Tauri) du même frontend : un exécutable unique, sans installation. **Ce n'est qu'une fenêtre qui
affiche ce même site** — elle ne contient ni serveur ni données propres. Au premier lancement,
elle demande l'adresse du serveur en ligne à utiliser (typiquement ce déploiement) et la retient
localement, uniquement sur le poste où elle tourne : deux personnes qui lancent chacune
l'exécutable portable partagent les mêmes sessions en ligne (rien n'est stocké dans l'exécutable
lui-même), mais leur choix de serveur, leur session admin/créateur·rice et leur identité de
participant·e restent propres à leur poste. Voir son README pour la compilation.
