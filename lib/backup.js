// Sauvegardes : copie complète des données du tournoi, gardée dans la base (table « backups »),
// copiée en plus dans Vercel Blob si le stockage est configuré, et téléchargeable en fichier.
// Ce module n'ajoute qu'une table ; il ne modifie jamais les tables existantes, sauf lors d'une
// restauration demandée par un super administrateur (et une sauvegarde de l'état actuel est faite juste avant).
import { randomBytes } from 'node:crypto';
import { q, exec } from './db.js';
import { AppError, ensureReady, invalidate, nowStamp } from './store.js';

export const BACKUP_FORMAT = 'ultras-tournoi-sauvegarde';
// Ordre d'insertion (respecte les clés étrangères). Les sessions de connexion ne sont pas sauvegardées.
export const BACKUP_TABLES = ['settings', 'users', 'teams', 'players', 'matches', 'events', 'lineups', 'audit_log'];
const ORDER_BY = { settings: 'key', lineups: 'match_id, player_id' };
// Nombre de sauvegardes conservées par type.
const KEEP = { auto: 45, manuelle: 30, 'avant-restauration': 15 };
// Une sauvegarde automatique au plus toutes les 20 heures (l'appel planifié peut être répété sans risque).
const AUTO_MIN_HOURS = 20;

const ADMIN = ['superadmin', 'admin'];
function requireRole(user, roles) {
  if (!user || !roles.includes(user.role)) throw new AppError('Action non autorisée pour ce compte.');
}

let tableReady = null;
export function ensureBackupTable() {
  if (!tableReady) {
    tableReady = exec(`BEGIN;
SELECT pg_advisory_xact_lock(771020);
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY, created_at TEXT NOT NULL, created_ms DOUBLE PRECISION NOT NULL,
  kind TEXT NOT NULL, username TEXT, size INTEGER NOT NULL, summary TEXT, blob_url TEXT, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS backups_kind_idx ON backups(kind, created_ms);
COMMIT;`).catch((e) => {
      tableReady = null;
      throw e;
    });
  }
  return tableReady;
}

// Copie complète des données, sous forme d'objet JSON.
export async function snapshot() {
  await ensureReady();
  const parts = BACKUP_TABLES.map((t) => `'${t}', (SELECT coalesce(json_agg(x ORDER BY ${ORDER_BY[t] || 'id'}), '[]'::json) FROM ${t} x)`);
  const rows = await q(`SELECT json_build_object(${parts.join(', ')})::text AS data`);
  const tables = JSON.parse(rows[0].data);
  return {
    format: BACKUP_FORMAT,
    version: 1,
    created_at: nowStamp(),
    data_version: (tables.settings.find((s) => s.key === 'data_version') || {}).value || null,
    tables,
  };
}

export function summarize(backup) {
  const t = backup.tables || {};
  const n = (k) => (Array.isArray(t[k]) ? t[k].length : 0);
  const done = (t.matches || []).filter((m) => m.status === 'finished').length;
  return `${n('teams')} équipes · ${n('players')} joueurs · ${n('matches')} matchs (${done} terminés) · ${n('events')} actions · ${n('users')} comptes`;
}

// Vérifie qu'un fichier est bien une sauvegarde complète et cohérente de cette application.
export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT || !backup.tables) {
    throw new AppError("Ce fichier n'est pas une sauvegarde Ultras Tournoi.");
  }
  for (const t of BACKUP_TABLES) {
    if (!Array.isArray(backup.tables[t])) throw new AppError(`Sauvegarde incomplète : « ${t} » manquant.`);
  }
  const { teams, players, matches, users, settings } = backup.tables;
  if (!teams.length || !players.length || !matches.length) throw new AppError('Sauvegarde vide (aucune équipe, aucun joueur ou aucun match) : restauration refusée.');
  if (!users.some((u) => u.role === 'superadmin')) throw new AppError('Sauvegarde sans super administrateur : restauration refusée.');
  if (!settings.some((s) => s.key === 'seeded')) throw new AppError('Sauvegarde incomplète (paramètres manquants).');
  const teamIds = new Set(teams.map((x) => x.id));
  if (players.some((p) => !teamIds.has(p.team_id))) throw new AppError('Sauvegarde incohérente (joueur sans équipe).');
  return backup;
}

async function copyToBlob(id, text) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { put } = await import('@vercel/blob');
    const day = nowStamp().slice(0, 10);
    const res = await put(`sauvegardes/ultras-tournoi-${day}-${id}-${randomBytes(12).toString('hex')}.json`, text, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });
    return res.url;
  } catch (e) {
    console.error('Copie Blob de la sauvegarde impossible', e);
    return null;
  }
}

async function prune(kind) {
  const keep = KEEP[kind] || 30;
  await q('DELETE FROM backups WHERE kind = $1 AND id NOT IN (SELECT id FROM backups WHERE kind = $1 ORDER BY created_ms DESC, id DESC LIMIT $2) RETURNING id', [kind, keep]);
}

async function store(kind, username) {
  await ensureBackupTable();
  const backup = await snapshot();
  const text = JSON.stringify(backup);
  const rows = await q('INSERT INTO backups (created_at, created_ms, kind, username, size, summary, data) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [backup.created_at, Date.now(), kind, username || null, Buffer.byteLength(text), summarize(backup), text]);
  const id = rows[0].id;
  const url = await copyToBlob(id, text);
  if (url) await q('UPDATE backups SET blob_url = $1 WHERE id = $2 RETURNING id', [url, id]);
  await prune(kind);
  return { id, created_at: backup.created_at, size: Buffer.byteLength(text), blob: !!url };
}

// Sauvegarde automatique (tâche planifiée) : ignorée si la dernière a moins de 20 heures.
export async function autoBackup({ force = false } = {}) {
  await ensureBackupTable();
  if (!force) {
    const last = await q("SELECT created_ms FROM backups WHERE kind = 'auto' ORDER BY created_ms DESC LIMIT 1");
    if (last.length && Date.now() - Number(last[0].created_ms) < AUTO_MIN_HOURS * 3600 * 1000) return { skipped: true };
  }
  return store('auto', 'automatique');
}

export async function manualBackup(user) {
  requireRole(user, ADMIN);
  return store('manuelle', user.username);
}

export async function listBackups(user) {
  requireRole(user, ADMIN);
  await ensureBackupTable();
  return q('SELECT id, created_at, kind, username, size, summary, (blob_url IS NOT NULL) AS in_blob FROM backups ORDER BY created_ms DESC, id DESC');
}

// Contenu d'une sauvegarde (texte JSON) ; sans id : l'état actuel.
export async function backupText(user, id) {
  requireRole(user, ADMIN);
  if (id === undefined || id === null || id === 'actuel') return { text: JSON.stringify(await snapshot()), created_at: nowStamp() };
  await ensureBackupTable();
  const rows = await q('SELECT created_at, data FROM backups WHERE id = $1', [parseInt(id, 10) || 0]);
  if (!rows.length) throw new AppError('Sauvegarde introuvable.');
  return { text: rows[0].data, created_at: rows[0].created_at };
}

function dollarQuote(text) {
  let tag;
  do tag = `bk${randomBytes(6).toString('hex')}`;
  while (text.includes(tag));
  return `$${tag}$${text}$${tag}$`;
}

// Restauration complète. Réservée au super administrateur. Une sauvegarde « avant-restauration »
// de l'état actuel est toujours faite d'abord : une restauration peut donc elle-même être annulée.
export async function restoreBackup(user, { id, text }) {
  requireRole(user, ['superadmin']);
  let source = text;
  if (!source) source = (await backupText(user, id)).text;
  let backup;
  try {
    backup = JSON.parse(source);
  } catch {
    throw new AppError("Fichier illisible : ce n'est pas une sauvegarde valide.");
  }
  validateBackup(backup);
  const before = await store('avant-restauration', user.username);
  const json = dollarQuote(JSON.stringify(backup.tables));
  const parts = ['BEGIN;', 'SELECT pg_advisory_xact_lock(771021);', `CREATE TEMP TABLE __bk ON COMMIT DROP AS SELECT ${json}::json AS d;`];
  // Tout est vidé puis réinséré dans une seule transaction : en cas d'erreur, rien n'est modifié.
  parts.push(`TRUNCATE ${[...BACKUP_TABLES].reverse().join(', ')}, sessions RESTART IDENTITY CASCADE;`);
  for (const t of BACKUP_TABLES) {
    parts.push(`INSERT INTO ${t} SELECT * FROM json_populate_recordset(NULL::${t}, (SELECT d -> '${t}' FROM __bk));`);
  }
  for (const t of BACKUP_TABLES) {
    if (t === 'settings' || t === 'lineups') continue;
    parts.push(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT coalesce(max(id), 0) + 1 FROM ${t}), false);`);
  }
  parts.push(`INSERT INTO audit_log (at, username, action, detail) VALUES (${sqlText(nowStamp())}, ${sqlText(user.username)}, 'Restauration d''une sauvegarde', ${sqlText(`Sauvegarde du ${backup.created_at || '?'} restaurée (état précédent sauvegardé : n° ${before.id})`)});`);
  parts.push('COMMIT;');
  await exec(parts.join('\n'));
  invalidate();
  return { before: before.id, created_at: backup.created_at };
}

function sqlText(v) {
  return `'${String(v ?? '').replace(/'/g, "''")}'`;
}
