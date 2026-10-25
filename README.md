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

Sans configuration, l'app fonctionne en local uniquement. Pour activer la synchro, voir
[Synchro entre les deux téléphones](#synchro-entre-les-deux-téléphones).

Pour l'installer sur un téléphone il faut une URL en HTTPS (Vercel, Netlify ou GitHub Pages).
- iPhone : ouvrir dans Safari, Partager, « Sur l'écran d'accueil ».
- Pixel : ouvrir dans Chrome, menu, « Installer l'application ».

## Architecture

| Couche | Choix | Pourquoi |
|---|---|---|
| App | React 19 + Vite + TypeScript | Un seul code pour iOS et Android, pas de store à passer |
| PWA | vite-plugin-pwa (Workbox) | Installation sur l'écran d'accueil, fonctionne hors-ligne |
| Données (v0) | IndexedDB via Dexie | Zéro compte à créer pour tester, photos stockées en local |
| Synchro | Supabase (Postgres + Storage + Auth + Realtime) | Garde-robe partagée entre les deux téléphones |

```
src/
  domain/      types.ts (modèle de données), catalog.ts (catégories, palette, occasions, moods)
  data/        db.ts (schéma IndexedDB), repo.ts (seul point d'accès aux données), photo.ts (compression)
  matching/    engine.ts (moteur de suggestion à critères)
  sync/        client.ts (Supabase, si configuré), engine.ts (envoi / réception / temps réel)
  components/  ui.tsx (vignettes, chips, panneau)
  pages/       Today, Wardrobe, ItemForm, Outfits, Settings
```

Les écrans ne parlent qu'à `data/repo.ts`, qui écrit dans IndexedDB et note chaque changement
dans une file d'attente (`outbox`). La synchro fonctionne « local d'abord » :

- l'app reste rapide et utilisable sans réseau ;
- les changements locaux partent vers Supabase dès que possible (nouvel essai automatique) ;
- ceux de l'autre téléphone arrivent en temps réel, au retour dans l'app, et toutes les minutes ;
- en cas de conflit, la dernière modification gagne, sauf qu'une modification locale pas encore
  envoyée n'est jamais écrasée.

## Synchro entre les deux téléphones

1. Créer un projet sur [supabase.com](https://supabase.com) (formule gratuite).
2. Dans **SQL Editor**, exécuter `supabase/migrations/0001_foyer_et_synchro.sql`.
3. Copier `.env.example` en `.env.local` et y mettre la Project URL et la clé **anon**
   (Project Settings > API). Sur l'hébergeur, définir les mêmes variables.
4. Dans l'app, onglet Réglages : chacun crée son compte. Le premier crée la garde-robe partagée
   et donne le code affiché à l'autre, qui le saisit pour la rejoindre.

Ce qui a déjà été saisi sur un téléphone avant la connexion est envoyé dans le foyer.

Côté serveur, toutes les données sont dans une table `records` (une ligne par objet, contenu en
JSON) et les photos dans le bucket privé `photos/<foyer>/<vêtement>.jpg`. Les règles RLS limitent
chaque compte à son foyer (vérifié : un autre compte ne voit ni les données ni les photos).

Développement local : `npx supabase start` (Docker) applique la migration, puis mettre l'URL et la
clé anon affichées dans `.env.local`.

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
2. **Partage (fait)** : Supabase, un « foyer » avec deux comptes, photos dans Storage.
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
  quelques semaines d'inactivité. Installer l'app sur l'écran d'accueil évite ce cas ; avec la
  synchro activée, tout est de toute façon récupéré depuis Supabase.
- **Connexion sur iPhone** : l'app installée et Safari ne partagent pas leur session. Il faut se
  connecter depuis l'app installée (d'où le choix e-mail + mot de passe plutôt qu'un lien magique).
- **Colorimétrie du visage** : la déduire d'une photo est peu fiable (éclairage, balance des blancs
  du téléphone) et une photo de visage est une donnée sensible. Meilleur rapport fiabilité/effort :
  la saisir à la main une fois.
- **Saisie** : le vrai frein de ce type d'app est le temps pour photographier toute la garde-robe.
  Le détourage automatique et la détection de couleur sur photo sont de bons candidats après le partage.
