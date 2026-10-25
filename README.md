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

Pour l'installer sur un téléphone il faut une URL en HTTPS (Vercel, Netlify ou GitHub Pages).
- iPhone : ouvrir dans Safari, Partager, « Sur l'écran d'accueil ».
- Pixel : ouvrir dans Chrome, menu, « Installer l'application ».

## Architecture

| Couche | Choix | Pourquoi |
|---|---|---|
| App | React 19 + Vite + TypeScript | Un seul code pour iOS et Android, pas de store à passer |
| PWA | vite-plugin-pwa (Workbox) | Installation sur l'écran d'accueil, fonctionne hors-ligne |
| Données (v0) | IndexedDB via Dexie | Zéro compte à créer pour tester, photos stockées en local |
| Données (v1) | Supabase (Postgres + Storage + Auth) | Garde-robe partagée entre les deux téléphones |

```
src/
  domain/      types.ts (modèle de données), catalog.ts (catégories, palette, occasions, moods)
  data/        db.ts (schéma IndexedDB), repo.ts (seul point d'accès aux données), photo.ts (compression)
  matching/    engine.ts (moteur de suggestion à critères)
  components/  ui.tsx (vignettes, chips, panneau)
  pages/       Today, Wardrobe, ItemForm, Outfits, Settings
```

Les écrans ne parlent qu'à `data/repo.ts`. Passer à Supabase revient à réécrire ce fichier
(et ajouter la connexion), sans toucher aux écrans.

## Modèle de données

- **Profile** : lui / elle. Champs prévus pour la suite : `colorSeason`, `undertone`, `favoriteColors`, `avoidColors`.
- **Item** (vêtement) : photo, catégorie, couleurs (nom + hex + famille), motif, saisons,
  `warmth` 1-5 (pour la météo), `formality` 1-5 (pour l'événement), `waterproof`, compteur de port.
- **Outfit** (tenue) : liste de vêtements, saisons, `occasions`, `moods`, `minTemp`/`maxTemp`, favori,
  `source` (manuel / règles / IA).
- **WearLog** : ce qui a été porté chaque jour, avec la météo, le mood et une note (sert à éviter
  les répétitions et, plus tard, à personnaliser les suggestions).
- **CoupleLook** : deux tenues assorties (une par profil) pour une même sortie.

## Moteur de suggestion

`matching/engine.ts` note chaque tenue enregistrée avec une liste de critères indépendants
(`Criterion = (tenue, contexte) => { score, raison }`). Aujourd'hui : disponibilité des pièces,
saison, pas portée récemment, favorite. Le critère météo est écrit mais inactif tant qu'on ne
fournit pas la météo. La raison du choix est affichée à l'utilisateur.

## Feuille de route proposée

1. **MVP (fait)** : vêtements, tenues, tenue du jour, deux profils, stockage local.
2. **Partage** : Supabase, un « foyer » avec deux comptes, photos dans Storage. C'est ce qui permet
   de matcher vos tenues, sinon chaque téléphone a sa propre garde-robe.
3. **Météo** : Open-Meteo (gratuit, sans clé) + géolocalisation, active le critère `byWeather`.
4. **Événement et mood** : deux sélecteurs sur l'écran du jour, critères sur `occasions`/`formality`/`moods`.
5. **Couleurs par règles** : harmonie entre les pièces (neutres + 1 couleur, complémentaires,
   camaïeu), et génération de tenues nouvelles à partir des vêtements, pas seulement des tenues enregistrées.
6. **Couple** : proposer deux tenues assorties (CoupleLook).
7. **IA** : suggestion via un modèle de vision/langage appelé depuis une fonction serveur (jamais
   de clé API dans l'app), à partir des photos, de l'historique et des notes.
8. **Colorimétrie** : saisie manuelle de la saison colorimétrique, utilisée comme bonus de score.

## Points d'attention

- **Données locales** : sur iPhone, Safari peut effacer les données d'un site non installé après
  quelques semaines d'inactivité. Installer l'app sur l'écran d'accueil évite ce cas. Le stockage
  local reste une étape de test, pas une sauvegarde.
- **Colorimétrie du visage** : la déduire d'une photo est peu fiable (éclairage, balance des blancs
  du téléphone) et une photo de visage est une donnée sensible. Meilleur rapport fiabilité/effort :
  la saisir à la main une fois.
- **Saisie** : le vrai frein de ce type d'app est le temps pour photographier toute la garde-robe.
  Le détourage automatique et la détection de couleur sur photo sont de bons candidats après le partage.
