# Ultras Tournoi

Application web de gestion et de suivi du tournoi de football 8 contre 8 Ultras (13 équipes, 2 groupes, quarts, demi-finales et finale).

- **Site public** (`/`) : accueil, matchs, fiches match en direct, classements et tableau final, équipes, joueurs, statistiques. Rafraîchissement automatique toutes les 10 secondes.
- **Back-office** (`/admin`) : saisie rapide des matchs sur téléphone, validation des résultats, gestion des équipes, joueurs, calendrier, comptes, paramètres, historique et exports Excel / PDF.

## Format

- Groupe A : 7 équipes, groupe B : 6 équipes. Chaque équipe joue 4 matchs de groupe (26 matchs), selon le programme officiel daté du 16 novembre au 14 décembre 2026.
- Les 4 premiers de chaque groupe vont en quarts (1er A - 4e B, 2e A - 3e B, 1er B - 4e A, 2e B - 3e A), puis demi-finales et finale le 26 décembre. 33 matchs au total.
- Le programme officiel, les groupes et les effectifs sont dans `lib/realdata.js`.

## Technique

- Next.js (App Router) sur Vercel, base Postgres (Neon) via `DATABASE_URL`, images via Vercel Blob (`BLOB_READ_WRITE_TOKEN`, facultatif).
- Les tables et les données de démonstration se créent automatiquement à la première visite.
- Classements, qualifications, statistiques et suspensions sont **calculés** à partir des matchs et des événements (rien n'est stocké en double) : `lib/engine.js`.
- Règles : victoire 3 pts, nul 1 pt ; départage configurable (points, différence, buts marqués, confrontation directe, fair-play) ; phase finale avec prolongation 2 × 10 min puis tirs au but ; suspension après un rouge ou 3 jaunes cumulés.

## Sauvegardes

- Chaque nuit vers 4 h (heure de Kinshasa), la tâche planifiée Vercel (`vercel.json` → `/api/cron/sauvegarde`) fait une copie complète des données dans la table `backups` (45 gardées), et dans Vercel Blob si `BLOB_READ_WRITE_TOKEN` est défini.
- Back-office → *Sauvegardes* : sauvegarde manuelle, téléchargement (.json), restauration (super administrateur, l'état actuel est sauvegardé juste avant).
- Facultatif : définir `CRON_SECRET` dans Vercel pour réserver l'appel planifié à Vercel (sans lui, l'appel reste sans risque : une sauvegarde automatique au plus toutes les 20 heures).

## Premier lancement

1. Ouvrir `/admin` : le premier compte créé devient super administrateur.
2. Créer les comptes des autres organisateurs (administrateur ou responsable de match).
3. Avant le vrai tournoi : *Paramètres → Effacer les résultats fictifs* (le calendrier est recalé sur la date de début), puis renommer les équipes et saisir les joueurs.

## Tests

```bash
npm test   # nécessite psql et une base locale "ut_test"
```
