# Gestionnaire de tokens — version portable (hors ligne)

Version bureau, portable, **entièrement hors ligne** du concept du
[Gestionnaire de tokens](../token-manager) : un exécutable unique, sans installation (dans
l'esprit d'un outil comme ZoomIt), avec son propre frontend (`src/`, indépendant de
`../token-manager/public`).

**Pas de serveur, pas de comptes.** L'état d'une session (participant·es, ressources/tokens,
qui a pris quoi et pourquoi, historique) est un simple fichier JSON que vous choisissez où
enregistrer — typiquement un dossier partagé avec l'équipe (OneDrive, lecteur réseau...), à côté
du fichier à protéger. Chaque collègue ouvre ce même fichier avec son propre exécutable : c'est la
synchronisation du dossier partagé (OneDrive, etc.) qui fait office de "serveur", pas l'application
elle-même. Chaque action (prendre/reposer un token) relit le fichier juste avant d'écrire pour
limiter le risque d'écrasement en cas d'actions simultanées — ça reste un compromis simple, pas un
vrai verrou distribué : deux personnes qui cliquent à la même seconde peuvent, en théorie, se
marcher dessus.

Seul le dernier fichier ouvert et l'identité choisie par participant·e sont retenus **localement,
sur ce poste uniquement** (dans le `localStorage` de la fenêtre).

## Compiler

Prérequis : [Rust](https://www.rust-lang.org/tools/install) + les
[prérequis Tauri](https://v2.tauri.app/start/prerequisites/) pour votre OS (sur Windows/macOS,
le webview système suffit — rien à installer en plus de Rust ; sur Linux, il faut
`libwebkit2gtk-4.1-dev` et `libgtk-3-dev`).

```sh
npm install
npm run build
```

Le binaire portable se trouve ensuite dans `src-tauri/target/release/` :

- Windows : `SquirrellabToken.exe` — copiez-le où vous voulez, double-cliquez, aucune
  installation requise.
- macOS : `SquirrellabToken`.
- Linux : `SquirrellabToken`.

Sur les releases GitHub (tag `token-manager-desktop-v*`), les binaires macOS et Linux sont
renommés `SquirrellabToken-macos` / `SquirrellabToken-linux` pour éviter un conflit de nom
d'asset — un simple `chmod +x` suffit ensuite pour les rendre exécutables.

(`tauri.conf.json` a `bundle.targets` vide : on ne génère pas d'installeur MSI/NSIS/DMG, juste
le binaire brut — c'est lui la version "portable".)

## Développement

```sh
npm run dev
```

Lance l'app avec rechargement à chaud, pointée sur le frontend local `src/`.

## CI

Le workflow [`.github/workflows/token-manager-desktop.yml`](../../.github/workflows/token-manager-desktop.yml)
compile automatiquement les exécutables Windows / macOS / Linux et les attache comme artefacts
(et, sur un tag `token-manager-desktop-v*`, comme assets d'une release GitHub).
