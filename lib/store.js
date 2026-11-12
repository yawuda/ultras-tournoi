// Lecture et écriture des données du tournoi. Toutes les règles d'accès sont ici.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { q, exec } from './db.js';
import { SCHEMA_SQL, STATE_SQL } from './schema.js';
import { seedScript, realDataScript, regenerateScript, insertSql, v3Script, v4Script, v5Script } from './seed.js';
import { buildSchedule, parseSlots, START_DATE, WEEKLY_SLOTS, VENUE } from './realdata.js';
import { build, bracketUpdates, liveMinute, DEFAULT_TIEBREAKERS, RUNNING_PERIODS, PERIOD_LABELS, num } from './engine.js';

export class AppError extends Error {}

const ADMIN = ['superadmin', 'admin'];
export const ROLES = { superadmin: 'Super administrateur', admin: 'Administrateur', manager: 'Responsable de match' };
const EVENT_TYPES = ['goal', 'own_goal', 'yellow', 'red', 'sub'];
const EVENT_LABELS = { goal: 'But', own_goal: 'But contre son camp', yellow: 'Carton jaune', red: 'Carton rouge', sub: 'Remplacement' };
const TZ = 'Africa/Kinshasa';

export function nowStamp(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'medium' }).format(d);
}
function nowHHMM() {
  return nowStamp().slice(11, 16);
}

// ---------- Initialisation ----------
let ready = null;
export function ensureReady() {
  if (!ready) {
    ready = init().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
async function init() {
  let seeded = false;
  try {
    seeded = (await q("SELECT value FROM settings WHERE key = 'seeded'")).length > 0;
  } catch {}
  if (!seeded) {
    await exec(SCHEMA_SQL);
    seeded = (await q("SELECT value FROM settings WHERE key = 'seeded'")).length > 0;
    if (!seeded) {
      try {
        await exec(seedScript());
      } catch (e) {
        const again = await q("SELECT value FROM settings WHERE key = 'seeded'");
        if (!again.length) throw e;
      }
    }
  }
  await migrate();
  await syncBracket();
}
// v2 : une base encore en démonstration passe sur les vraies équipes et les créneaux hebdomadaires.
async function migrate() {
  if (process.env.SEED_DEMO) return;
  const st = Object.fromEntries((await q("SELECT key, value FROM settings WHERE key IN ('data_version', 'demo')")).map((r) => [r.key, r.value]));
  const v = st.data_version || '';
  if (v === '5') return;
  if (!v && st.demo === '1') {
    await exec(realDataScript());
    return;
  }
  if (v !== '3' && v !== '4') await exec(v3Script());
  if (v !== '4') await exec(v4Script());
  await exec(v5Script());
}

// ---------- Lecture ----------
let cache = null;
export function invalidate() {
  cache = null;
}
export async function loadState({ fresh = false } = {}) {
  await ensureReady();
  if (!fresh && cache && Date.now() - cache.at < 4000) return cache.state;
  const rows = await q(STATE_SQL);
  const state = rows[0];
  cache = { at: Date.now(), state };
  return state;
}
export async function loadTournament(opts) {
  return build(await loadState(opts));
}

// ---------- Outils ----------
function requireRole(user, roles) {
  if (!user || !roles.includes(user.role)) throw new AppError('Action non autorisée pour ce compte.');
}
function int(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function str(v, max = 200) {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
}
async function audit(user, action, matchId, detail) {
  await q('INSERT INTO audit_log (at, username, action, match_id, detail) VALUES ($1, $2, $3, $4, $5) RETURNING id', [nowStamp(), user?.username || 'système', action, matchId ?? null, detail ?? null]);
}
async function getMatch(id) {
  const rows = await q('SELECT * FROM matches WHERE id = $1', [int(id)]);
  if (!rows.length) throw new AppError('Match introuvable.');
  return rows[0];
}
function requireMatchAccess(user, match) {
  if (user && ADMIN.includes(user.role)) return;
  if (user && user.role === 'manager' && match.manager_id === user.id) return;
  throw new AppError("Ce match ne vous est pas attribué.");
}
function requireEditable(user, match) {
  requireMatchAccess(user, match);
  if (match.status === 'scheduled') throw new AppError("Le match n'a pas encore commencé.");
  if (match.validated) throw new AppError('Résultat déjà validé : un administrateur doit le dévalider avant correction.');
  if (match.status === 'finished' && !ADMIN.includes(user.role)) throw new AppError('Match terminé : seul un administrateur peut corriger.');
}

export async function syncBracket() {
  invalidate();
  for (let pass = 0; pass < 3; pass++) {
    const T = build((await q(STATE_SQL))[0]);
    const ups = bracketUpdates(T);
    if (!ups.length) break;
    for (const u of ups) await q('UPDATE matches SET home_id = $1, away_id = $2 WHERE id = $3 RETURNING id', [u.home_id, u.away_id, u.id]);
    invalidate();
  }
}

// ---------- Comptes ----------
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validCreds(username, password) {
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new AppError("Nom d'utilisateur : 3 à 30 caractères (lettres, chiffres, . _ -).");
  if (String(password || '').length < 8) throw new AppError('Mot de passe : 8 caractères minimum.');
  return u;
}
export async function userCount() {
  await ensureReady();
  return (await q('SELECT count(*)::int AS n FROM users'))[0].n;
}
export async function createFirstAdmin({ username, password }) {
  await ensureReady();
  const u = validCreds(username, password);
  if ((await userCount()) > 0) throw new AppError('Un compte existe déjà : connectez-vous.');
  const rows = await q("INSERT INTO users (username, pass_hash, role, created_at) VALUES ($1, $2, 'superadmin', $3) RETURNING id, username, role", [u, hashPassword(password), nowStamp()]);
  return rows[0];
}
export async function createUser(user, { username, password, role }) {
  requireRole(user, ['superadmin']);
  const u = validCreds(username, password);
  if (!ROLES[role]) throw new AppError('Rôle inconnu.');
  const dup = await q('SELECT id FROM users WHERE username = $1', [u]);
  if (dup.length) throw new AppError("Ce nom d'utilisateur existe déjà.");
  const rows = await q('INSERT INTO users (username, pass_hash, role, created_at) VALUES ($1, $2, $3, $4) RETURNING id, username, role', [u, hashPassword(password), role, nowStamp()]);
  await audit(user, 'Compte créé', null, `${u} (${ROLES[role]})`);
  return rows[0];
}
export async function deleteUser(user, id) {
  requireRole(user, ['superadmin']);
  if (int(id) === user.id) throw new AppError('Vous ne pouvez pas supprimer votre propre compte.');
  const rows = await q('DELETE FROM users WHERE id = $1 RETURNING username', [int(id)]);
  if (rows.length) await audit(user, 'Compte supprimé', null, rows[0].username);
}
export async function setPassword(user, { id, password }) {
  const target = int(id) || user.id;
  if (target !== user.id) requireRole(user, ['superadmin']);
  if (String(password || '').length < 8) throw new AppError('Mot de passe : 8 caractères minimum.');
  await q('UPDATE users SET pass_hash = $1 WHERE id = $2 RETURNING id', [hashPassword(password), target]);
  await q('DELETE FROM sessions WHERE user_id = $1 AND $2 RETURNING token', [target, target !== user.id]);
}
export async function listUsers(user) {
  requireRole(user, ADMIN);
  return q('SELECT id, username, role, created_at FROM users ORDER BY id');
}
export async function login({ username, password }) {
  await ensureReady();
  const rows = await q('SELECT * FROM users WHERE username = $1', [String(username || '').trim().toLowerCase()]);
  if (!rows.length || !checkPassword(String(password || ''), rows[0].pass_hash)) throw new AppError('Identifiants incorrects.');
  const token = randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3) RETURNING token', [token, rows[0].id, Date.now() + 14 * 86400000]);
  return { token, user: { id: rows[0].id, username: rows[0].username, role: rows[0].role } };
}
export async function userFromToken(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await ensureReady();
  const rows = await q('SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > $2', [token, Date.now()]);
  return rows[0] || null;
}
export async function logout(token) {
  if (token) await q('DELETE FROM sessions WHERE token = $1 RETURNING token', [String(token)]);
}

// ---------- Équipes et joueurs ----------
export async function saveTeam(user, d) {
  requireRole(user, ADMIN);
  const name = str(d.name, 60);
  if (!name) throw new AppError("Le nom de l'équipe est obligatoire.");
  const short = (str(d.short, 4) || name.slice(0, 3)).toUpperCase();
  const grp = ['A', 'B', 'C', 'D'].includes(d.grp) ? d.grp : null;
  const vals = [name, short, grp, str(d.coach, 80), str(d.color, 9) || '#2B303A'];
  let id = int(d.id);
  if (id) await q('UPDATE teams SET name = $1, short = $2, grp = $3, coach = $4, color = $5 WHERE id = $6 RETURNING id', [...vals, id]);
  else id = (await q('INSERT INTO teams (name, short, grp, coach, color) VALUES ($1, $2, $3, $4, $5) RETURNING id', vals))[0].id;
  if (d.logo_url !== undefined) await q('UPDATE teams SET logo_url = $1 WHERE id = $2 RETURNING id', [str(d.logo_url, 500), id]);
  invalidate();
  return id;
}
export async function deleteTeam(user, id) {
  requireRole(user, ADMIN);
  const used = await q("SELECT count(*)::int AS n FROM matches WHERE (home_id = $1 OR away_id = $1) AND status <> 'scheduled'", [int(id)]);
  if (used[0].n > 0) throw new AppError('Impossible : cette équipe a déjà des matchs joués.');
  await q('DELETE FROM teams WHERE id = $1 RETURNING id', [int(id)]);
  invalidate();
}
export async function savePlayer(user, d) {
  requireRole(user, ADMIN);
  const last = str(d.last_name, 60);
  const teamId = int(d.team_id);
  if (!last || !teamId) throw new AppError('Nom et équipe obligatoires.');
  const pos = ['G', 'D', 'M', 'A'].includes(d.position) ? d.position : null;
  const vals = [teamId, str(d.first_name, 60), last, int(d.number), pos];
  let id = int(d.id);
  if (id) await q('UPDATE players SET team_id = $1, first_name = $2, last_name = $3, number = $4, position = $5 WHERE id = $6 RETURNING id', [...vals, id]);
  else id = (await q('INSERT INTO players (team_id, first_name, last_name, number, position) VALUES ($1, $2, $3, $4, $5) RETURNING id', vals))[0].id;
  if (d.photo_url !== undefined) await q('UPDATE players SET photo_url = $1 WHERE id = $2 RETURNING id', [str(d.photo_url, 500), id]);
  // Un seul capitaine par équipe
  const captain = d.is_captain === true || d.is_captain === '1' || d.is_captain === 'on';
  if (captain) await q('UPDATE players SET is_captain = (id = $1) WHERE team_id = $2 RETURNING id', [id, teamId]);
  else await q('UPDATE players SET is_captain = FALSE WHERE id = $1 RETURNING id', [id]);
  invalidate();
  return id;
}
export async function deletePlayer(user, id) {
  requireRole(user, ADMIN);
  await q('DELETE FROM players WHERE id = $1 RETURNING id', [int(id)]);
  invalidate();
}

// ---------- Matchs ----------
export async function saveMatch(user, d) {
  requireRole(user, ADMIN);
  const kickoff = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.kickoff || '') ? d.kickoff : null;
  if (!kickoff) throw new AppError('Date et heure obligatoires.');
  const id = int(d.id);
  const venue = str(d.venue, 80);
  const manager = int(d.manager_id);
  if (id) {
    const m = await getMatch(id);
    let home = m.home_id;
    let away = m.away_id;
    if (m.status === 'scheduled' && d.home_id !== undefined) {
      home = int(d.home_id);
      away = int(d.away_id);
      if (home && home === away) throw new AppError('Une équipe ne peut pas jouer contre elle-même.');
    }
    await q('UPDATE matches SET kickoff = $1, venue = $2, manager_id = $3, home_id = $4, away_id = $5 WHERE id = $6 RETURNING id', [kickoff, venue, manager, home, away, id]);
    if (m.kickoff !== kickoff) await audit(user, 'Programmation modifiée', id, `${m.kickoff} → ${kickoff}`);
    invalidate();
    return id;
  }
  const phase = ['group', 'qf', 'sf', 'third', 'final'].includes(d.phase) ? d.phase : 'group';
  const home = int(d.home_id);
  const away = int(d.away_id);
  if (!home || !away || home === away) throw new AppError('Sélectionnez deux équipes différentes.');
  const grp = phase === 'group' ? (await q('SELECT grp FROM teams WHERE id = $1', [home]))[0]?.grp || null : null;
  const rows = await q('INSERT INTO matches (phase, grp, round, code, kickoff, venue, home_id, away_id, manager_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id', [phase, grp, int(d.round), str(d.code, 10), kickoff, venue, home, away, manager]);
  invalidate();
  return rows[0].id;
}
export async function deleteMatch(user, id) {
  requireRole(user, ADMIN);
  const m = await getMatch(id);
  if (m.status !== 'scheduled') throw new AppError('Impossible de supprimer un match commencé.');
  await q('DELETE FROM matches WHERE id = $1 RETURNING id', [m.id]);
  invalidate();
}
export async function startMatch(user, id) {
  const m = await getMatch(id);
  requireMatchAccess(user, m);
  if (m.status !== 'scheduled') throw new AppError('Match déjà commencé.');
  if (!m.home_id || !m.away_id) throw new AppError('Les deux équipes ne sont pas encore connues.');
  await q("UPDATE matches SET status = 'live', period = '1H', period_started_at = $1, started_at = $2 WHERE id = $3 RETURNING id", [Date.now(), nowHHMM(), m.id]);
  await audit(user, 'Match démarré', m.id, null);
  invalidate();
}
export async function setPeriod(user, id, period) {
  const m = await getMatch(id);
  requireMatchAccess(user, m);
  if (m.status !== 'live') throw new AppError("Le match n'est pas en cours.");
  if (!(period in PERIOD_LABELS) || period === '') throw new AppError('Période inconnue.');
  if (['ET1', 'ETB', 'ET2', 'PEN', 'FT'].includes(period) && m.phase === 'group') throw new AppError('Pas de prolongation en phase de groupes.');
  await q('UPDATE matches SET period = $1, period_started_at = $2 WHERE id = $3 RETURNING id', [period, RUNNING_PERIODS.includes(period) ? Date.now() : null, m.id]);
  invalidate();
}
export async function setPens(user, id, home, away) {
  const m = await getMatch(id);
  requireMatchAccess(user, m);
  if (m.phase === 'group') throw new AppError('Pas de tirs au but en phase de groupes.');
  if (m.validated) throw new AppError('Résultat déjà validé.');
  await q('UPDATE matches SET home_pens = $1, away_pens = $2 WHERE id = $3 RETURNING id', [int(home), int(away), m.id]);
  await audit(user, 'Tirs au but saisis', m.id, `${int(home)} - ${int(away)}`);
  invalidate();
}
async function scoreOf(matchId) {
  const T = build(await loadState({ fresh: true }));
  return T.matchById.get(matchId);
}
export async function finishMatch(user, id) {
  const m = await getMatch(id);
  requireMatchAccess(user, m);
  if (m.status !== 'live') throw new AppError("Le match n'est pas en cours.");
  const v = await scoreOf(m.id);
  if (m.phase !== 'group' && v.hs === v.as && (m.home_pens == null || m.away_pens == null || m.home_pens === m.away_pens)) {
    throw new AppError('Égalité en phase finale : jouez la prolongation puis saisissez les tirs au but.');
  }
  await q("UPDATE matches SET status = 'finished', period = '', period_started_at = NULL, ended_at = $1 WHERE id = $2 RETURNING id", [nowHHMM(), m.id]);
  await audit(user, 'Match terminé (brouillon)', m.id, `${v.hs} - ${v.as}`);
  invalidate();
}
export async function validateMatch(user, id) {
  requireRole(user, ADMIN);
  const m = await getMatch(id);
  if (m.status !== 'finished') throw new AppError("Le match n'est pas terminé.");
  const v = await scoreOf(m.id);
  if (m.phase !== 'group' && !v.winner_id) throw new AppError('Phase finale : il faut un vainqueur (tirs au but).');
  await q('UPDATE matches SET validated = TRUE WHERE id = $1 RETURNING id', [m.id]);
  await audit(user, 'Résultat validé', m.id, `${v.hs} - ${v.as}`);
  await syncBracket();
}
export async function unvalidateMatch(user, id) {
  requireRole(user, ADMIN);
  const m = await getMatch(id);
  if (!m.validated) return;
  await q('UPDATE matches SET validated = FALSE WHERE id = $1 RETURNING id', [m.id]);
  await audit(user, 'Résultat dévalidé pour correction', m.id, null);
  await syncBracket();
}
export async function resetMatch(user, id) {
  requireRole(user, ADMIN);
  const m = await getMatch(id);
  await q('DELETE FROM events WHERE match_id = $1 RETURNING id', [m.id]);
  await q("UPDATE matches SET status = 'scheduled', validated = FALSE, period = '', period_started_at = NULL, started_at = NULL, ended_at = NULL, home_pens = NULL, away_pens = NULL, is_demo = FALSE WHERE id = $1 RETURNING id", [m.id]);
  await audit(user, 'Match remis à zéro', m.id, null);
  await syncBracket();
}

// ---------- Événements ----------
async function checkEvent(m, d) {
  const type = EVENT_TYPES.includes(d.type) ? d.type : null;
  if (!type) throw new AppError("Type d'événement inconnu.");
  const teamId = int(d.team_id);
  if (teamId !== m.home_id && teamId !== m.away_id) throw new AppError("Cette équipe ne joue pas ce match.");
  const ids = [int(d.player_id), int(d.assist_id), int(d.player_in_id)].filter(Boolean);
  if (ids.length) {
    const ps = await q(`SELECT id, team_id FROM players WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})`, ids);
    if (ps.length !== new Set(ids).size || ps.some((p) => p.team_id !== teamId)) throw new AppError("Joueur invalide pour cette équipe.");
  }
  if (type !== 'goal' && type !== 'own_goal' && !int(d.player_id)) throw new AppError('Sélectionnez le joueur.');
  if (type === 'sub' && !int(d.player_in_id)) throw new AppError('Sélectionnez le joueur entrant.');
  const minute = Math.max(1, Math.min(130, int(d.minute) || 1));
  return [teamId, int(d.player_id), type, minute, type === 'goal' ? int(d.assist_id) : null, type === 'sub' ? int(d.player_in_id) : null];
}
export async function addEvent(user, d) {
  const m = await getMatch(d.match_id);
  requireEditable(user, m);
  if (!int(d.minute)) {
    const live = liveMinute(m, (await loadState()).settings);
    d = { ...d, minute: live || 1 };
  }
  const vals = await checkEvent(m, d);
  const rows = await q('INSERT INTO events (match_id, team_id, player_id, type, minute, assist_id, player_in_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [m.id, ...vals]);
  await audit(user, `${EVENT_LABELS[vals[2]]} ajouté`, m.id, `${vals[3]}'`);
  invalidate();
  return rows[0].id;
}
export async function updateEvent(user, d) {
  const ev = (await q('SELECT * FROM events WHERE id = $1', [int(d.id)]))[0];
  if (!ev) throw new AppError('Événement introuvable.');
  const m = await getMatch(ev.match_id);
  requireEditable(user, m);
  const vals = await checkEvent(m, { ...ev, ...d });
  await q('UPDATE events SET team_id = $1, player_id = $2, type = $3, minute = $4, assist_id = $5, player_in_id = $6 WHERE id = $7 RETURNING id', [...vals, ev.id]);
  await audit(user, `${EVENT_LABELS[vals[2]]} corrigé`, m.id, `${vals[3]}'`);
  invalidate();
}
export async function deleteEvent(user, id) {
  const ev = (await q('SELECT * FROM events WHERE id = $1', [int(id)]))[0];
  if (!ev) return;
  const m = await getMatch(ev.match_id);
  requireEditable(user, m);
  await q('DELETE FROM events WHERE id = $1 RETURNING id', [ev.id]);
  await audit(user, `${EVENT_LABELS[ev.type] || ev.type} annulé`, m.id, `${ev.minute}'`);
  invalidate();
}
export async function setLineup(user, { match_id, team_id, starters = [], subs = [] }) {
  const m = await getMatch(match_id);
  requireMatchAccess(user, m);
  if (m.validated) throw new AppError('Résultat déjà validé.');
  const teamId = int(team_id);
  if (teamId !== m.home_id && teamId !== m.away_id) throw new AppError("Cette équipe ne joue pas ce match.");
  const squad = new Set((await q('SELECT id FROM players WHERE team_id = $1', [teamId])).map((p) => p.id));
  const st = [...new Set(starters.map(int))].filter((id) => squad.has(id));
  const sb = [...new Set(subs.map(int))].filter((id) => squad.has(id) && !st.includes(id));
  await q('DELETE FROM lineups WHERE match_id = $1 AND team_id = $2 RETURNING match_id', [m.id, teamId]);
  for (const id of st) await q('INSERT INTO lineups (match_id, player_id, team_id, starter) VALUES ($1, $2, $3, TRUE) RETURNING match_id', [m.id, id, teamId]);
  for (const id of sb) await q('INSERT INTO lineups (match_id, player_id, team_id, starter) VALUES ($1, $2, $3, FALSE) RETURNING match_id', [m.id, id, teamId]);
  invalidate();
}

// ---------- Paramètres et démo ----------
const SETTING_KEYS = ['start_date', 'slots', 'name', 'subtitle', 'venue', 'half_minutes', 'et_minutes', 'yellow_suspension', 'tiebreakers', 'manual_order', 'banner_url', 'logo_url'];
export async function saveSettings(user, obj) {
  requireRole(user, ADMIN);
  for (const [k, v] of Object.entries(obj)) {
    if (!SETTING_KEYS.includes(k)) continue;
    let val = String(v ?? '').trim().slice(0, 600);
    if (k === 'tiebreakers') {
      const arr = (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter((s) => DEFAULT_TIEBREAKERS.includes(s));
      for (const c of DEFAULT_TIEBREAKERS) if (!arr.includes(c)) arr.push(c);
      val = JSON.stringify([...new Set(arr)]);
    }
    if (k === 'slots') {
      val = parseSlots(val).map((s) => `${s.wd}-${s.time}`).join(',');
      if (!val) throw new AppError('Indiquez au moins un créneau (ex. : lun 20:00).');
    }
    if (k === 'start_date' && val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) throw new AppError('Date de début invalide.');
    if (['half_minutes', 'et_minutes', 'yellow_suspension'].includes(k)) val = String(Math.max(1, num(val, 1)));
    await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING key', [k, val]);
  }
  await audit(user, 'Paramètres modifiés', null, Object.keys(obj).filter((k) => SETTING_KEYS.includes(k)).join(', '));
  await syncBracket();
}
// Efface uniquement les résultats fictifs : équipes, joueurs et calendrier sont conservés.
export async function clearDemoResults(user) {
  requireRole(user, ADMIN);
  await q('DELETE FROM events WHERE match_id IN (SELECT id FROM matches WHERE is_demo) RETURNING id');
  await q('DELETE FROM lineups WHERE match_id IN (SELECT id FROM matches WHERE is_demo) RETURNING match_id');
  await q("UPDATE matches SET status = 'scheduled', validated = FALSE, period = '', period_started_at = NULL, started_at = NULL, ended_at = NULL, home_pens = NULL, away_pens = NULL, is_demo = FALSE WHERE is_demo RETURNING id");
  await q("UPDATE settings SET value = '0' WHERE key = 'demo' RETURNING key");
  await audit(user, 'Résultats de démonstration effacés', null, null);
  await syncBracket();
}
// Recrée tout le calendrier (groupes actuels + créneaux) tant qu'aucun match n'a commencé.
export async function rebuildSchedule(user) {
  requireRole(user, ADMIN);
  const started = await q("SELECT count(*)::int AS n FROM matches WHERE status <> 'scheduled'");
  if (started[0].n > 0) throw new AppError('Des matchs ont déjà commencé : modifiez la programmation match par match dans le calendrier.');
  const st = Object.fromEntries((await q('SELECT key, value FROM settings')).map((r) => [r.key, r.value]));
  const teams = await q('SELECT t.id, t.grp, (SELECT count(*) FROM players p WHERE p.team_id = t.id) = 0 AS placeholder FROM teams t ORDER BY t.id');
  for (const g of ['A', 'B', 'C', 'D']) {
    const n = teams.filter((x) => x.grp === g).length;
    if (n !== 4) throw new AppError(`Le groupe ${g} compte ${n} équipe(s) : il en faut exactement 4.`);
  }
  const matches = buildSchedule(teams, { start: st.start_date || START_DATE, slots: st.slots || WEEKLY_SLOTS, venue: st.venue || VENUE });
  const cols = ['id', 'phase', 'grp', 'round', 'code', 'kickoff', 'venue', 'home_id', 'away_id', 'home_src', 'away_src', 'status', 'validated', 'period', 'period_started_at', 'started_at', 'ended_at', 'home_pens', 'away_pens', 'manager_id', 'is_demo'];
  await exec(`BEGIN;\nTRUNCATE lineups, events, matches RESTART IDENTITY CASCADE;\n${insertSql('matches', matches, cols)}\nSELECT setval(pg_get_serial_sequence('matches', 'id'), (SELECT coalesce(max(id), 1) FROM matches));\nCOMMIT;`);
  await audit(user, 'Calendrier régénéré', null, `${matches.length} matchs à partir du ${st.start_date || START_DATE}`);
  invalidate();
}
export async function regenerateDemo(user) {
  requireRole(user, ['superadmin']);
  await exec(regenerateScript());
  await audit(user, 'Données de démonstration régénérées', null, null);
  invalidate();
}
export async function auditLog(user, limit = 200) {
  requireRole(user, ADMIN);
  return q('SELECT * FROM audit_log ORDER BY id DESC LIMIT $1', [int(limit) || 200]);
}
