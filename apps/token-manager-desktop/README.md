# Gestionnaire de tokens — version portable

Version bureau, portable, du [Gestionnaire de tokens](../token-manager) : un exécutable unique,
sans installation (dans l'esprit d'un outil comme ZoomIt), qui affiche exactement la même
interface que le site (`../token-manager/public`, réutilisée telle quelle via `frontendDist`
dans `src-tauri/tauri.conf.json`).

L'application ne contient **pas** de serveur : au premier lancement, elle demande l'adresse du
serveur du Gestionnaire de tokens (celui déployé sur le site, ou une instance interne) et la
retient localement. Elle se comporte ensuite exactement comme la version web.

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

- Windows : `token-manager-desktop.exe` — copiez-le où vous voulez, double-cliquez, aucune
  installation requise.
- macOS : `token-manager-desktop`.
- Linux : `token-manager-desktop`.

(`tauri.conf.json` a `bundle.targets` vide : on ne génère pas d'installeur MSI/NSIS/DMG, juste
le binaire brut — c'est lui la version "portable".)

## Développement

```sh
npm run dev
```

Lance l'app avec rechargement à chaud, pointée sur le frontend de `../token-manager/public`.

## CI

Le workflow [`.github/workflows/token-manager-desktop.yml`](../../.github/workflows/token-manager-desktop.yml)
compile automatiquement les exécutables Windows / macOS / Linux et les attache comme artefacts
(et, sur un tag `token-manager-desktop-v*`, comme assets d'une release GitHub).
