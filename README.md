# Ultras Tournoi

Application web de gestion et de suivi du tournoi de football 8 contre 8 Ultras (16 équipes, 4 groupes, phase finale).

- **Site public** (`/`) : accueil, matchs, fiches match en direct, classements et tableau final, équipes, joueurs, statistiques. Rafraîchissement automatique toutes les 10 secondes.
- **Back-office** (`/admin`) : saisie rapide des matchs sur téléphone, validation des résultats, gestion des équipes, joueurs, calendrier, comptes, paramètres, historique et exports Excel / PDF.

## Technique

- Next.js (App Router) sur Vercel, base Postgres (Neon) via `DATABASE_URL`, images via Vercel Blob (`BLOB_READ_WRITE_TOKEN`, facultatif).
- Les tables et les données de démonstration se créent automatiquement à la première visite.
- Classements, qualifications, statistiques et suspensions sont **calculés** à partir des matchs et des événements (rien n'est stocké en double) : `lib/engine.js`.
- Règles : victoire 3 pts, nul 1 pt ; départage configurable (points, différence, buts marqués, confrontation directe, fair-play) ; phase finale avec prolongation 2 × 10 min puis tirs au but ; suspension après un rouge ou 3 jaunes cumulés.

## Premier lancement

1. Ouvrir `/admin` : le premier compte créé devient super administrateur.
2. Créer les comptes des autres organisateurs (administrateur ou responsable de match).
3. Avant le vrai tournoi : *Paramètres → Effacer les résultats fictifs* (le calendrier est recalé sur la date de début), puis renommer les équipes et saisir les joueurs.

## Tests

```bash
npm test   # nécessite psql et une base locale "ut_test"
```
