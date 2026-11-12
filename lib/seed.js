import { buildReal, TEAMS, ADDED_V3, ADDED_V5, CAPTAINS_V3, CAPTAINS_V4, splitName } from './realdata.js';

// Données de démonstration : 16 équipes, 13 joueurs chacune, calendrier complet,
// et résultats fictifs pour les premiers matchs. Générateur déterministe.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Jean', 'Patrick', 'Christian', 'Junior', 'Glody', 'Héritier', 'Trésor', 'Dieumerci', 'Cédric', 'Yannick', 'Chancel', 'Exaucé', 'Jonathan', 'Arsène', 'Fiston', 'Bienvenu', 'Emmanuel', 'Samuel', 'Daniel', 'Joël', 'Gédéon', 'Ruben', 'Élie', 'Moïse', 'Prince', 'Rodrigue', 'Serge', 'Thierry', 'Alain', 'Blaise', 'Steve', 'Kevin', 'Landry', 'Nathan', 'Olivier', 'Pascal', 'Guy', 'Hervé', 'Michel', 'David'];
const LAST = ['Kabeya', 'Ilunga', 'Mbuyi', 'Tshibangu', 'Lukusa', 'Kalala', 'Mukendi', 'Banza', 'Ngoy', 'Mwamba', 'Kasongo', 'Kabongo', 'Nsimba', 'Mavungu', 'Lokwa', 'Mbemba', 'Kiala', 'Matondo', 'Bokete', 'Luyeye', 'Nzuzi', 'Makiese', 'Bolamba', 'Lumbala', 'Mpiana', 'Kanda', 'Diyabanza', 'Longo', 'Kiese', 'Tshimanga', 'Kalonji', 'Mulumba', 'Kazadi', 'Ngalula', 'Bope', 'Masudi', 'Lufuluabo', 'Mutombo', 'Kapinga', 'Ntumba'];
const COLORS = ['#1D4ED8', '#B91C1C', '#047857', '#7C3AED', '#C2410C', '#0E7490', '#A21CAF', '#4D7C0F', '#BE123C', '#1E40AF', '#92400E', '#115E59', '#6D28D9', '#9F1239', '#3F6212', '#334155'];
const POSITIONS = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'A', 'A', 'A', 'G'];
const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

export function weekdaysFrom(start, count) {
  const [y, m, d] = start.split('-').map(Number);
  const out = [];
  let t = Date.UTC(y, m - 1, d);
  while (out.length < count) {
    const dt = new Date(t);
    const wd = dt.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(dt.toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
}

export function buildSchedule({ startDate, times, venue, teamIdsByGroup }) {
  const days = weekdaysFrom(startDate, 16);
  const matches = [];
  let id = 1;
  const groups = ['A', 'B', 'C', 'D'];
  for (let d = 0; d < 12; d++) {
    const g = groups[d % 4];
    const round = Math.floor(d / 4) + 1;
    const ids = teamIdsByGroup[g];
    PAIRINGS[round - 1].forEach(([h, a], i) => {
      matches.push({ id: id++, phase: 'group', grp: g, round, code: `${g}${(round - 1) * 2 + i + 1}`, kickoff: `${days[d]}T${times[i]}`, venue, home_id: ids[h], away_id: ids[a], home_src: null, away_src: null });
    });
  }
  const ko = [
    ['qf', 'QF1', '1A', '2B', 12, 0],
    ['qf', 'QF2', '1B', '2A', 12, 1],
    ['qf', 'QF3', '1C', '2D', 13, 0],
    ['qf', 'QF4', '1D', '2C', 13, 1],
    ['sf', 'DF1', 'W:QF1', 'W:QF3', 14, 0],
    ['sf', 'DF2', 'W:QF2', 'W:QF4', 14, 1],
    ['third', '3P', 'L:DF1', 'L:DF2', 15, 0],
    ['final', 'F', 'W:DF1', 'W:DF2', 15, 1],
  ];
  for (const [phase, code, hs, as, day, slot] of ko) {
    matches.push({ id: id++, phase, grp: null, round: null, code, kickoff: `${days[day]}T${times[slot]}`, venue, home_id: null, away_id: null, home_src: hs, away_src: as });
  }
  return matches;
}

export const REAL_START = '2026-11-16';
export const MATCH_TIMES = ['16:00', '17:15'];

export function todayKinshasa(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Kinshasa' }).format(d);
}
// Démo « tournoi commencé depuis une semaine » : début le lundi de la semaine précédente,
// résultats fictifs pour tous les matchs des jours déjà passés.
export function demoTiming(today = process.env.DEMO_TODAY || todayKinshasa()) {
  const [y, m, d] = today.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const wd = new Date(t).getUTCDay() || 7;
  const start = new Date(t - (wd - 1 + 7) * 86400000).toISOString().slice(0, 10);
  const days = weekdaysFrom(start, 16);
  const past = days.filter((x) => x < today).length;
  return { startDate: start, playedMatches: Math.min(24, past * 2) };
}

export function buildDemo(opts = {}) {
  const timing = demoTiming();
  const { startDate = timing.startDate, times = MATCH_TIMES, venue = 'Terrain Ultras', playedMatches = timing.playedMatches, seed = 2026 } = opts;
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const teams = [];
  const players = [];
  const teamIdsByGroup = { A: [], B: [], C: [], D: [] };
  let pid = 1;
  for (let i = 0; i < 16; i++) {
    const grp = 'ABCD'[Math.floor(i / 4)];
    teams.push({ id: i + 1, name: `Équipe ${i + 1}`, short: `E${i + 1}`, grp, coach: `${pick(FIRST)} ${pick(LAST)}`, logo_url: null, color: COLORS[i] });
    teamIdsByGroup[grp].push(i + 1);
    const used = new Set();
    for (let n = 0; n < 13; n++) {
      let fn;
      let ln;
      do {
        fn = pick(FIRST);
        ln = pick(LAST);
      } while (used.has(fn + ln));
      used.add(fn + ln);
      players.push({ id: pid++, team_id: i + 1, first_name: fn, last_name: ln, number: n + 1, position: POSITIONS[n], photo_url: null });
    }
  }
  const matches = buildSchedule({ startDate, times, venue, teamIdsByGroup }).map((m) => ({
    ...m, status: 'scheduled', validated: false, period: '', period_started_at: null, started_at: null, ended_at: null, home_pens: null, away_pens: null, manager_id: null, is_demo: false,
  }));
  const events = [];
  const lineups = [];
  let eid = 1;
  const goalsDist = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4];
  const weight = { G: 0.05, D: 1, M: 3, A: 5 };
  const weighted = (list) => {
    const total = list.reduce((s, p) => s + weight[p.position], 0);
    let r = rand() * total;
    for (const p of list) {
      r -= weight[p.position];
      if (r <= 0) return p;
    }
    return list[list.length - 1];
  };
  for (const m of matches.slice(0, playedMatches)) {
    m.status = 'finished';
    m.validated = true;
    m.is_demo = true;
    const [, hhmm] = m.kickoff.split('T');
    m.started_at = hhmm;
    const [h, mi] = hhmm.split(':').map(Number);
    const end = h * 60 + mi + 60;
    m.ended_at = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    for (const tid of [m.home_id, m.away_id]) {
      const squad = players.filter((p) => p.team_id === tid);
      const starters = [squad[0], squad[1], squad[2], squad[3], squad[5], squad[6], squad[9], squad[10]];
      const subs = squad.filter((p) => !starters.includes(p));
      for (const p of squad) lineups.push({ match_id: m.id, player_id: p.id, team_id: tid, starter: starters.includes(p) });
      const goals = pick(goalsDist);
      for (let g = 0; g < goals; g++) {
        const scorer = weighted(starters);
        const others = starters.filter((p) => p !== scorer && p.position !== 'G');
        events.push({ match_id: m.id, team_id: tid, player_id: scorer.id, type: 'goal', minute: 1 + Math.floor(rand() * 50), assist_id: rand() < 0.6 ? pick(others).id : null, player_in_id: null });
      }
      const yellows = pick([0, 0, 1, 1, 2]);
      for (let c = 0; c < yellows; c++) {
        events.push({ match_id: m.id, team_id: tid, player_id: pick(starters.slice(1)).id, type: 'yellow', minute: 5 + Math.floor(rand() * 45), assist_id: null, player_in_id: null });
      }
      if (rand() < 0.06) events.push({ match_id: m.id, team_id: tid, player_id: pick(starters.slice(1)).id, type: 'red', minute: 30 + Math.floor(rand() * 20), assist_id: null, player_in_id: null });
      const nsubs = 2 + Math.floor(rand() * 2);
      const outPool = starters.slice(1);
      for (let s = 0; s < nsubs; s++) {
        const out = outPool.splice(Math.floor(rand() * outPool.length), 1)[0];
        events.push({ match_id: m.id, team_id: tid, player_id: out.id, type: 'sub', minute: 26 + Math.floor(rand() * 20), assist_id: null, player_in_id: subs[s].id });
      }
    }
  }
  events.sort((a, b) => a.match_id - b.match_id || a.minute - b.minute);
  for (const e of events) e.id = eid++;
  const settings = {
    name: 'Ultras Tournoi',
    subtitle: 'Football 8 contre 8',
    venue,
    half_minutes: '25',
    et_minutes: '10',
    yellow_suspension: '3',
    tiebreakers: JSON.stringify(['points', 'diff', 'goals', 'h2h', 'fairplay']),
    manual_order: '{}',
    start_date: REAL_START,
    match_times: times.join(','),
    demo: '1',
  };
  return { settings, teams, players, matches, events, lineups };
}

export function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function insertSql(table, rows, cols) {
  if (!rows.length) return '';
  const out = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    out.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${chunk.map((r) => `(${cols.map((c) => sqlValue(r[c])).join(', ')})`).join(',\n')};`);
  }
  return out.join('\n');
}

export function demoDataSql(demo) {
  const settingsRows = Object.entries(demo.settings).map(([key, value]) => ({ key, value }));
  return [
    settingsRows.map((r) => `INSERT INTO settings (key, value) VALUES (${sqlValue(r.key)}, ${sqlValue(r.value)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`).join('\n'),
    insertSql('teams', demo.teams, ['id', 'name', 'short', 'grp', 'coach', 'logo_url', 'color']),
    insertSql('players', demo.players.map((x) => ({ is_captain: false, ...x })), ['id', 'team_id', 'first_name', 'last_name', 'number', 'position', 'photo_url', 'is_captain']),
    insertSql('matches', demo.matches, ['id', 'phase', 'grp', 'round', 'code', 'kickoff', 'venue', 'home_id', 'away_id', 'home_src', 'away_src', 'status', 'validated', 'period', 'period_started_at', 'started_at', 'ended_at', 'home_pens', 'away_pens', 'manager_id', 'is_demo']),
    insertSql('events', demo.events, ['id', 'match_id', 'team_id', 'player_id', 'type', 'minute', 'assist_id', 'player_in_id']),
    insertSql('lineups', demo.lineups, ['match_id', 'player_id', 'team_id', 'starter']),
    ...['teams', 'players', 'matches', 'events'].map((t) => `SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT coalesce(max(id), 1) FROM ${t}));`),
  ].join('\n');
}

// Script d'initialisation : ne s'exécute qu'une fois (clé 'seeded' unique).
export function seedScript(demo = process.env.SEED_DEMO ? buildDemo() : buildReal()) {
  return `BEGIN;\nSELECT pg_advisory_xact_lock(771002);\nINSERT INTO settings (key, value) VALUES ('seeded', '1');\n${demoDataSql(demo)}\nCOMMIT;`;
}

export function regenerateScript(demo = buildDemo()) {
  return `BEGIN;\nTRUNCATE lineups, events, matches, players, teams RESTART IDENTITY CASCADE;\n${demoDataSql(demo)}\nCOMMIT;`;
}

// Remplace les données de démonstration par les vraies équipes (comptes conservés).
export function realDataScript() {
  return `BEGIN;\nSELECT pg_advisory_xact_lock(771003);\nTRUNCATE lineups, events, matches, players, teams RESTART IDENTITY CASCADE;\n${demoDataSql(buildReal())}\nCOMMIT;`;
}

// v3 : les places « Équipe 10 » et « Équipe 11 » deviennent Aigle et Z Team (si elles sont encore vides),
// et les capitaines déjà connus sont désignés. Sans effet si l'organisateur a déjà modifié ces équipes.
export function v3Script() {
  const parts = ['BEGIN;', 'SELECT pg_advisory_xact_lock(771004);', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;'];
  for (const idx of ADDED_V3) parts.push(...fillPlaceholderSql(idx, false));
  for (const [short, first, last] of CAPTAINS_V3) {
    parts.push(`UPDATE players SET is_captain = TRUE WHERE first_name = ${sqlValue(first)} AND last_name = ${sqlValue(last)} AND team_id = (SELECT id FROM teams WHERE short = ${sqlValue(short)} LIMIT 1) AND NOT EXISTS (SELECT 1 FROM players p2 WHERE p2.team_id = players.team_id AND p2.is_captain);`);
  }
  parts.push("INSERT INTO settings (key, value) VALUES ('data_version', '3') ON CONFLICT (key) DO UPDATE SET value = '3';", 'COMMIT;');
  return parts.join('\n');
}

export function v4Script() {
  const est = "(SELECT id FROM teams WHERE short = 'EST' LIMIT 1)";
  const full = "lower(concat_ws(' ', first_name, last_name))";
  const parts = ['BEGIN;', 'SELECT pg_advisory_xact_lock(771005);', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;'];
  // Espérance de Tunis : Dida retiré (s'il n'a encore aucune action), Heni Derouich ajouté, Khaled Sayed Fathy gardien
  parts.push(`DELETE FROM players WHERE team_id = ${est} AND ${full} = 'dida' AND NOT EXISTS (SELECT 1 FROM events e WHERE e.player_id = players.id OR e.assist_id = players.id OR e.player_in_id = players.id);`);
  parts.push(`INSERT INTO players (team_id, first_name, last_name) SELECT ${est}, 'Heni', 'Derouich' WHERE ${est} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM players WHERE team_id = ${est} AND ${full} = 'heni derouich');`);
  parts.push(`UPDATE players SET position = 'G' WHERE team_id = ${est} AND ${full} = 'khaled sayed fathy';`);
  for (const [short, name] of CAPTAINS_V4) {
    const team = `(SELECT id FROM teams WHERE short = ${sqlValue(short)} LIMIT 1)`;
    const n = sqlValue(name.toLowerCase());
    parts.push(`UPDATE players SET is_captain = (${full} = ${n}) WHERE team_id = ${team} AND EXISTS (SELECT 1 FROM players p2 WHERE p2.team_id = ${team} AND lower(concat_ws(' ', p2.first_name, p2.last_name)) = ${n});`);
  }
  parts.push("INSERT INTO settings (key, value) VALUES ('data_version', '4') ON CONFLICT (key) DO UPDATE SET value = '4';", 'COMMIT;');
  return parts.join('\n');
}

// Une place « Équipe N » encore vide devient une équipe confirmée (avec son capitaine).
function fillPlaceholderSql(idx, withCaptain = true) {
  const [name, short, color, list] = TEAMS[idx];
  const id = idx + 1;
  const out = [`UPDATE teams SET name = ${sqlValue(name)}, short = ${sqlValue(short)}, color = ${sqlValue(color)} WHERE id = ${id} AND name = ${sqlValue(`Équipe ${id}`)} AND NOT EXISTS (SELECT 1 FROM players WHERE team_id = ${id});`];
  const rows = list.map((e) => {
    const [n, flag] = Array.isArray(e) ? e : [e, null];
    const s = splitName(n);
    return `(${sqlValue(s.first_name)}, ${sqlValue(s.last_name)}, ${sqlValue(flag === 'G' ? 'G' : null)}, ${withCaptain && flag === 'C' ? 'TRUE' : 'FALSE'})`;
  });
  out.push(`INSERT INTO players (team_id, first_name, last_name, position, is_captain) SELECT ${id}, v.f, v.l, v.p, v.c FROM (VALUES ${rows.join(', ')}) AS v(f, l, p, c) WHERE (SELECT name FROM teams WHERE id = ${id}) = ${sqlValue(name)} AND NOT EXISTS (SELECT 1 FROM players WHERE team_id = ${id});`);
  return out;
}

export function v5Script() {
  const parts = ['BEGIN;', 'SELECT pg_advisory_xact_lock(771006);'];
  for (const idx of ADDED_V5) parts.push(...fillPlaceholderSql(idx));
  parts.push("INSERT INTO settings (key, value) VALUES ('data_version', '5') ON CONFLICT (key) DO UPDATE SET value = '5';", 'COMMIT;');
  return parts.join('\n');
}
