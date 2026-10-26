# Je mets quoi ?

Application web installable (PWA) pour recenser nos vêtements, composer des tenues à l'avance
et recevoir une « tenue du jour » le matin. Fonctionne sur iPhone (Safari) et Android (Chrome).

## Lancer

```bash
npm install
npm run dev        # développement, http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # sert le build (avec service worker)
```

## Installer sur les téléphones

L'app est publiée automatiquement sur GitHub Pages à chaque fusion dans `main`
(`.github/workflows/deploy.yml`) : https://cybercookie-code.github.io/Garde-Robe/

- iPhone : ouvrir le lien dans **Safari**, Partager, « Sur l'écran d'accueil ».
- Pixel : ouvrir le lien dans Chrome, menu ⋮, « Installer l'application ».

Réglage à faire une fois dans le dépôt : Settings > Pages > Source = « GitHub Actions »
(le dépôt doit être public pour Pages en formule gratuite).

## Architecture

| Couche | Choix | Pourquoi |
|---|---|---|
| App | React 19 + Vite + TypeScript | Un seul code pour iOS et Android, pas de store à passer |
| PWA | vite-plugin-pwa (Workbox) | Installation sur l'écran d'accueil, fonctionne hors-ligne |
| Données | IndexedDB via Dexie | Chaque téléphone a sa propre garde-robe, sans compte ni serveur |
| Sauvegarde / partage | Fichier JSON (photos incluses) | Pas de serveur à maintenir ; partage via la feuille de partage du téléphone |
| Hébergement | GitHub Pages | Gratuit, HTTPS, déployé à chaque fusion |

```
src/
  domain/      types.ts (modèle de données), catalog.ts (catégories, palette, occasions, moods)
  data/        db.ts (schéma IndexedDB), repo.ts (seul point d'accès aux données), photo.ts (compression),
               backup.ts (sauvegarde, restauration, partage par fichier)
  matching/    engine.ts (moteur de suggestion à critères)
  components/  ui.tsx (vignettes, chips, panneau)
  pages/       Today, Wardrobe, ItemForm, Outfits, Settings
```

Les écrans ne parlent qu'à `data/repo.ts`. Une synchro serveur (Supabase) a été écrite et testée
sur la branche `feat/synchro-supabase`, puis mise de côté : on préfère une version locale par téléphone.

## Sauvegarde et partage

- **Sauvegarder tout** (Réglages) : un fichier JSON avec vêtements, photos, tenues et historique,
  à ranger dans iCloud Drive ou Google Drive. Un rappel s'affiche sur l'écran du jour après 14 jours
  sans sauvegarde (dès 5 vêtements).
- **Importer un fichier** : restaure une sauvegarde ou ajoute un partage. Les données sont fusionnées
  (même identifiant = remplacé, rien n'est supprimé).
- **Partager** une tenue (onglet Tenues) ou toute sa garde-robe (Réglages) : le fichier part par
  AirDrop, Messages, WhatsApp… et, une fois importé, apparaît dans le profil de l'expéditeur sur
  l'autre téléphone. C'est ce qui permet d'assortir vos tenues sans serveur. Limite : c'est une copie,
  pas une synchro ; il faut renvoyer le fichier après des changements.
- Au démarrage, l'app demande au navigateur un stockage persistant (`navigator.storage.persist`).

## Interface

- Direction visuelle « app moderne douce » : fond sable dégradé, grandes cartes très arrondies,
  chiffres XXL (température du jour), pilules, capsule sombre flottante pour la navigation et les
  actions, un seul accent corail (texte sombre dessus pour garder un contraste suffisant). Police
  Geist embarquée pour rester lisible hors ligne. La tenue du jour est une grande carte photo avec son
  nom et les raisons du choix en surimpression.
- Mobile d'abord : barre d'onglets flottante (icônes SVG, nom affiché sur l'onglet actif), gros titres, bouton « + » flottant à portée
  de pouce, boutons « Je la porte » / « Autre idée » toujours visibles sur l'écran du jour.
- Ajout rapide : photo → catégorie → « Ajouter » (ou « Ajouter + suivant » pour enchaîner). La couleur
  est devinée sur la photo (fond retiré, centre analysé), le nom est proposé à partir de la catégorie
  et de la couleur ; les matières se cochent juste en dessous ; saisons, chaleur, style et motif sont dans « Plus de détails ».
- Retours : messages courts en haut de l'écran, avec « Annuler » après une suppression ; « Changer de
  tenue » annule « Je la porte ».
- Accessibilité : cibles tactiles de 44 px minimum, états `aria-pressed` / `aria-current`, panneaux
  `role="dialog"` fermables avec Échap, focus visible, animations coupées si « réduire les animations ».
- Mode sombre automatique (selon le réglage du téléphone).

## Détourage et couleurs

À chaque nouvelle photo, le fond est retiré sur le téléphone (rien n'est envoyé), puis la couleur est devinée sur le vêtement seul.

- Modèle [U²-Net « p »](https://github.com/xuebinqin/U-2-Net) (licence Apache 2.0, fichier `public/models/u2netp.onnx` repris de [rembg](https://github.com/danielgatis/rembg)), exécuté par `onnxruntime-web` en WebAssembly, sur un seul fil (GitHub Pages n'envoie pas les en-têtes COOP/COEP).
- Poids : moteur 14,2 Mo (3,7 Mo compressé) + modèle 4,6 Mo, chargés au premier détourage seulement, puis gardés par le service worker (cache `detourage`) : ça marche ensuite hors ligne.
- Environ 2 s par photo sur un ordinateur ; compter plus sur un téléphone.
- Résultat enregistré en WebP transparent (PNG si le navigateur ne sait pas écrire le WebP), recadré, 720 px au plus.
- Limites : une personne sur la photo est gardée avec le vêtement ; avec deux objets (une paire de chaussures), l'un peut être à moitié effacé ; un fond chargé peut laisser des restes. « Remettre le fond » revient à la photo d'origine, et le détourage automatique se coupe dans Réglages.
- La couleur reste une suggestion : une ombre peut faire passer un blanc pour du gris ou un rouge pour du bordeaux.

## Modèle de données

- **Profile** : un seul par téléphone (`moi`) ; les vêtements et tenues reçus par partage ont le propriétaire `recu`. Champs prévus pour la suite : `colorSeason`, `undertone`, `favoriteColors`, `avoidColors`.
- **Item** (vêtement) : photo, catégorie, couleurs (nom + hex + famille), motif, saisons,
  `warmth` 1-5 (pour la météo), `formality` 1-5 (pour l'événement), `waterproof`, `materials` (coton, lin, laine, cachemire, soie,
  jean, cuir, daim, synthétique, technique, polaire, viscose ; plusieurs possibles), compteur de port.
- **Outfit** (tenue) : liste de vêtements, saisons, `occasions`, `moods`, `minTemp`/`maxTemp`, favori,
  `source` (manuel / règles / IA).
- **WearLog** : ce qui a été porté chaque jour, avec la météo, le mood et une note (sert à éviter
  les répétitions et, plus tard, à personnaliser les suggestions).
- **CoupleLook** : deux tenues assorties (une par profil) pour une même sortie.

## Moteur de suggestion

`matching/engine.ts` note chaque tenue enregistrée avec une liste de critères indépendants
(`Criterion = (tenue, contexte) => { score, raison }`). Aujourd'hui : disponibilité des pièces,
saison, pas portée récemment, favorite, météo, événement, matières. Les matières nuancent sans
remplacer la chaleur et le style saisis : lin et coton par forte chaleur, laine et polaire par
froid, daim, soie ou cachemire à éviter sous la pluie, matières habillées pour une soirée, techniques
pour le sport (`domain/materials.ts`). Une pièce sans matière ne change rien au score. La raison du choix est affichée.
Tests : `npm test` (Vitest), lancés aussi par la CI.

Limite connue : le moteur classe les tenues enregistrées, il n'en compose pas. Par 3 °C, une tenue
de cérémonie sans manteau est signalée « trop légère » mais aucun manteau n'est ajouté pour autant.

## Feuille de route proposée

1. **MVP (fait)** : vêtements, tenues, tenue du jour, deux profils, stockage local.
2. **Hébergement, sauvegarde et partage par fichier (fait)**.
3. **Météo (fait)** : Open-Meteo (gratuit, sans clé), position mémorisée ou ville choisie dans
   Réglages. Température ressentie moyenne de 8 h à 20 h comparée au niveau de chaleur de la pièce la
   plus chaude ; bonus pour une pièce imperméable si la pluie est probable (≥ 50 %).
4. **Événement (fait)** : choix sur l'écran du jour ; occasions de la tenue si renseignées, sinon
   niveau d'habillé moyen des pièces. **Mood** : à faire, même principe.
5. **Couleurs par règles** : harmonie entre les pièces (neutres + 1 couleur, complémentaires,
   camaïeu), et génération de tenues nouvelles à partir des vêtements, pas seulement des tenues enregistrées.
6. **Couple** : proposer deux tenues assorties (CoupleLook).
7. **IA** : suggestion via un modèle de vision/langage appelé depuis une fonction serveur (jamais
   de clé API dans l'app), à partir des photos, de l'historique et des notes.
8. **Colorimétrie** : saisie manuelle de la saison colorimétrique, utilisée comme bonus de score.

## Points d'attention

- **Données locales** : sur iPhone, Safari peut effacer les données d'un site non installé après
  quelques semaines d'inactivité. Installer l'app sur l'écran d'accueil évite ce cas. Sans serveur,
  le fichier de sauvegarde est la seule copie de secours : le rappel est là pour ça.
- **Colorimétrie du visage** : la déduire d'une photo est peu fiable (éclairage, balance des blancs
  du téléphone) et une photo de visage est une donnée sensible. Meilleur rapport fiabilité/effort :
  la saisir à la main une fois.
- **Saisie** : le vrai frein de ce type d'app est le temps pour photographier toute la garde-robe.
  Le détourage automatique et la détection de couleur sur photo sont de bons candidats après le partage.
