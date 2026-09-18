# Distributeur d'images — version portable (hors ligne)

Exécutable de bureau unique, sans installation, qui tire une image au hasard dans un dossier
fourni par l'utilisateur. **Pas de serveur, pas de compte, pas de connexion réseau** : tout se
passe sur la machine de la personne qui lance l'outil.

- Les **sous-dossiers immédiats** du dossier choisi deviennent des catégories filtrables (cases à
  cocher). Les images posées directement à la racine forment la catégorie « Sans catégorie ».
- Le tirage évite de répéter une image déjà sortie tant que toutes celles du filtre courant n'ont
  pas été tirées (le cycle se réinitialise automatiquement une fois épuisé, ou manuellement via le
  bouton dédié).
- Le dernier dossier choisi est retenu **localement** (`localStorage` de la fenêtre) et rechargé
  automatiquement au lancement suivant s'il existe encore.
- Formats gérés : `.jpg .jpeg .png .gif .webp .bmp`.

## Compiler

Prérequis : [Rust](https://www.rust-lang.org/tools/install) + les
[prérequis Tauri](https://v2.tauri.app/start/prerequisites/) pour votre OS :

- **Windows** : Rust (via `rustup`) **et** les *Visual Studio Build Tools* avec le composant
  « Desktop development with C++ » (fournit le linker MSVC — sans lui, `cargo build` échoue à
  l'édition de liens). Le webview système (WebView2) est lui déjà présent sur la quasi-totalité
  des postes Windows 10/11.
- **macOS** : Rust seul suffit, le webview système est déjà présent.
- **Linux** : Rust + `libwebkit2gtk-4.1-dev` et `libgtk-3-dev`.

```sh
npm install
npm run build
```

Le binaire portable se trouve ensuite dans `src-tauri/target/release/` :

- Windows : `SquirrellabImages.exe` — copiez-le où vous voulez, double-cliquez, aucune
  installation requise. Windows SmartScreen affichera un avertissement « éditeur inconnu » tant
  que le binaire n'est pas signé (pas de certificat de signature de code pour l'instant) —
  cliquer sur « Informations complémentaires » puis « Exécuter quand même ».
- macOS / Linux : `SquirrellabImages`.

(`tauri.conf.json` a `bundle.targets` vide : on ne génère pas d'installeur MSI/NSIS/DMG, juste le
binaire brut — c'est lui la version « portable ».)

## Développement

```sh
npm run dev
```

Lance l'app avec rechargement à chaud, pointée sur le frontend local `src/`.

## CI

Le workflow [`.github/workflows/image-picker-desktop.yml`](../../.github/workflows/image-picker-desktop.yml)
compile automatiquement les exécutables Windows / macOS / Linux et les attache comme artefacts
(et, sur un tag `image-picker-desktop-v*`, comme assets d'une release GitHub) — utile pour obtenir
un binaire sans avoir Rust installé en local.
