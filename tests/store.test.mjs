// Test complet sur une vraie base Postgres : démo, back-office, tournoi joué jusqu'à la finale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { adapter, resetDb } from './psql-adapter.mjs';
import { setAdapter } from '../lib/db.js';
import * as S from '../lib/store.js';
import { groupStandings, groupComplete, tournamentStatus, tournamentStats, playerStats, ranking, qualifiedTeams } from '../lib/engine.js';

process.env.DEMO_TODAY = '2026-11-09';
process.env.SEED_DEMO = '1';
setAdapter(adapter);
resetDb();
let admin, manager, boss;
const T = () => S.loadTournament({ fresh: true });

async function play(u, m, hs, as, validate = true) {
  await S.startMatch(u, m.id);
  const t = await T();
  const hp = t.players.filter((p) => p.team_id === m.home_id);
  const ap = t.players.filter((p) => p.team_id === m.away_id);
  for (let i = 0; i < hs; i++) await S.addEvent(u, { match_id: m.id, team_id: m.home_id, type: 'goal', player_id: hp[9].id, assist_id: hp[6].id, minute: 5 + i });
  for (let i = 0; i < as; i++) await S.addEvent(u, { match_id: m.id, team_id: m.away_id, type: 'goal', player_id: ap[10].id, minute: 30 + i });
  await S.finishMatch(u, m.id);
  if (validate) await S.validateMatch(boss, m.id);
}

test('initialisation : schéma + démo, une seule fois', async () => {
  await Promise.all([S.ensureReady(), S.ensureReady()]);
  const t = await T();
  assert.equal(t.teams.length, 16);
  assert.equal(t.players.length, 208);
  assert.equal(t.matches.length, 32);
  assert.equal(t.matches.filter((m) => m.official).length, 10);
  assert.equal(tournamentStatus(t), 'live');
  const st = tournamentStats(t);
  assert.equal(st.played, 10);
  assert.equal(st.goals, t.matches.reduce((s, m) => s + m.hs + m.as, 0));
  // cohérence : somme des points = 3 x victoires + 2 x nuls
  let pts = 0;
  for (const g of 'ABCD') pts += groupStandings(t, g).reduce((s, r) => s + r.pts, 0);
  const draws = t.matches.filter((m) => m.official && m.hs === m.as).length;
  assert.equal(pts, (10 - draws) * 3 + draws * 2);
});

test('comptes : premier super admin, rôles, connexion', async () => {
  await assert.rejects(() => S.createFirstAdmin({ username: 'ab', password: 'x' }), S.AppError);
  boss = await S.createFirstAdmin({ username: 'Chef', password: 'motdepasse1' });
  assert.equal(boss.role, 'superadmin');
  await assert.rejects(() => S.createFirstAdmin({ username: 'pirate', password: 'motdepasse1' }), /existe déjà/);
  admin = await S.createUser(boss, { username: 'orga', password: 'motdepasse2', role: 'admin' });
  manager = await S.createUser(boss, { username: 'terrain', password: 'motdepasse3', role: 'manager' });
  await assert.rejects(() => S.createUser(admin, { username: 'autre', password: 'motdepasse4', role: 'admin' }), /non autorisée/);
  await assert.rejects(() => S.login({ username: 'chef', password: 'faux' }), /incorrects/);
  const { token, user } = await S.login({ username: 'CHEF', password: 'motdepasse1' });
  assert.equal(user.id, boss.id);
  assert.equal((await S.userFromToken(token)).username, 'chef');
  await S.logout(token);
  assert.equal(await S.userFromToken(token), null);
  assert.equal(await S.userFromToken('x'), null);
});

test('match en direct : droits, événements, score, brouillon, validation, correction', async () => {
  let t = await T();
  const m = t.matches.find((x) => x.status === 'scheduled');
  assert.equal(m.code, 'B3');
  await assert.rejects(() => S.startMatch(manager, m.id), /pas attribué/);
  await assert.rejects(() => S.startMatch(null, m.id), S.AppError);
  await S.saveMatch(admin, { id: m.id, kickoff: m.kickoff, venue: m.venue, manager_id: manager.id });
  await assert.rejects(() => S.addEvent(manager, { match_id: m.id, team_id: m.home_id, type: 'goal' }), /pas encore commencé/);
  await S.startMatch(manager, m.id);
  const hp = t.players.filter((p) => p.team_id === m.home_id);
  const ap = t.players.filter((p) => p.team_id === m.away_id);
  await S.setLineup(manager, { match_id: m.id, team_id: m.home_id, starters: hp.slice(0, 8).map((p) => p.id), subs: hp.slice(8).map((p) => p.id) });
  const g1 = await S.addEvent(manager, { match_id: m.id, team_id: m.home_id, type: 'goal', player_id: hp[9].id, assist_id: hp[5].id, minute: 8 });
  await S.addEvent(manager, { match_id: m.id, team_id: m.away_id, type: 'goal', player_id: ap[9].id, minute: 12 });
  await S.addEvent(manager, { match_id: m.id, team_id: m.away_id, type: 'own_goal', player_id: ap[2].id, minute: 20 });
  await S.addEvent(manager, { match_id: m.id, team_id: m.home_id, type: 'yellow', player_id: hp[3].id, minute: 22 });
  await S.addEvent(manager, { match_id: m.id, team_id: m.home_id, type: 'sub', player_id: hp[3].id, player_in_id: hp[11].id, minute: 30 });
  await S.addEvent(manager, { match_id: m.id, team_id: m.home_id, type: 'goal' }); // score rapide sans buteur, minute auto
  await assert.rejects(() => S.addEvent(manager, { match_id: m.id, team_id: m.home_id, type: 'goal', player_id: ap[0].id, minute: 3 }), /Joueur invalide/);
  await assert.rejects(() => S.addEvent(manager, { match_id: m.id, team_id: 1, type: 'goal', minute: 3 }), /ne joue pas/);
  await assert.rejects(() => S.setPeriod(manager, m.id, 'ET1'), /phase de groupes/);
  await S.setPeriod(manager, m.id, 'HT');
  await S.setPeriod(manager, m.id, '2H');
  t = await T();
  let v = t.matchById.get(m.id);
  assert.deepEqual([v.hs, v.as, v.status, v.period], [3, 1, 'live', '2H']);
  assert.equal(v.lineup.filter((l) => l.starter).length, 8);
  const before = groupStandings(t, 'B').map((r) => r.pts).join();
  await S.finishMatch(manager, m.id);
  t = await T();
  assert.equal(groupStandings(t, 'B').map((r) => r.pts).join(), before, 'brouillon : classement inchangé');
  await assert.rejects(() => S.validateMatch(manager, m.id), /non autorisée/);
  await assert.rejects(() => S.deleteEvent(manager, g1), /administrateur/);
  await S.validateMatch(admin, m.id);
  t = await T();
  const row = groupStandings(t, 'B').find((r) => r.team.id === m.home_id);
  const prevRow = (await S.loadTournament()).matches.filter((x) => x.official && (x.home_id === m.home_id || x.away_id === m.home_id)).length;
  assert.equal(row.j, prevRow);
  assert.ok(row.v >= 1);
  // correction : il faut dévalider ; le classement et les stats suivent
  await assert.rejects(() => S.deleteEvent(admin, g1), /dévalider/);
  const goalsBefore = playerStats(t).get(hp[9].id).goals;
  await S.unvalidateMatch(admin, m.id);
  await S.deleteEvent(admin, g1);
  await S.validateMatch(admin, m.id);
  t = await T();
  v = t.matchById.get(m.id);
  assert.deepEqual([v.hs, v.as], [2, 1]);
  assert.equal(playerStats(t).get(hp[9].id).goals, goalsBefore - 1);
  const log = await S.auditLog(admin);
  assert.ok(log.some((l) => l.action === 'Résultat dévalidé pour correction' && l.username === 'orga'));
  assert.ok(log.some((l) => l.action === 'But annulé'));
});

test('fin des groupes : qualifications et quarts générés automatiquement', async () => {
  let t = await T();
  const rest = t.matches.filter((m) => m.phase === 'group' && m.status === 'scheduled');
  assert.equal(rest.length, 13);
  let i = 0;
  for (const m of rest) {
    await play(admin, m, (i * 7) % 4, (i * 3) % 3);
    i++;
    if (i === 5) {
      const mid = await T();
      assert.ok(mid.matches.filter((x) => x.phase === 'qf').every((x) => !x.home_id || groupComplete(mid, x.home_src[1])));
    }
  }
  t = await T();
  assert.ok('ABCD'.split('').every((g) => groupComplete(t, g)));
  assert.equal(qualifiedTeams(t).length, 8);
  const st = Object.fromEntries('ABCD'.split('').map((g) => [g, groupStandings(t, g)]));
  for (const g of 'ABCD') {
    assert.equal(st[g].reduce((s, r) => s + r.j, 0), 12);
    assert.equal(st[g].reduce((s, r) => s + r.diff, 0), 0);
  }
  const qf = (c) => t.matchByCode.get(c);
  assert.deepEqual([qf('QF1').home_id, qf('QF1').away_id], [st.A[0].team.id, st.B[1].team.id]);
  assert.deepEqual([qf('QF2').home_id, qf('QF2').away_id], [st.B[0].team.id, st.A[1].team.id]);
  assert.deepEqual([qf('QF3').home_id, qf('QF3').away_id], [st.C[0].team.id, st.D[1].team.id]);
  assert.deepEqual([qf('QF4').home_id, qf('QF4').away_id], [st.D[0].team.id, st.C[1].team.id]);
  assert.equal(qf('DF1').home_id, null);
});

test('phase finale : prolongation, tirs au but, 3e place, finale', async () => {
  let t = await T();
  const q1 = t.matchByCode.get('QF1');
  // QF1 : 1-1 -> impossible de terminer sans tirs au but
  await S.startMatch(admin, q1.id);
  const hp = t.players.filter((p) => p.team_id === q1.home_id);
  const ap = t.players.filter((p) => p.team_id === q1.away_id);
  await S.addEvent(admin, { match_id: q1.id, team_id: q1.home_id, type: 'goal', player_id: hp[9].id, minute: 10 });
  await S.addEvent(admin, { match_id: q1.id, team_id: q1.away_id, type: 'goal', player_id: ap[9].id, minute: 40 });
  await assert.rejects(() => S.finishMatch(admin, q1.id), /Égalité/);
  for (const p of ['FT', 'ET1', 'ETB', 'ET2', 'PEN']) await S.setPeriod(admin, q1.id, p);
  await S.setPens(admin, q1.id, 4, 4);
  await assert.rejects(() => S.finishMatch(admin, q1.id), /Égalité/);
  await S.setPens(admin, q1.id, 3, 4);
  await S.finishMatch(admin, q1.id);
  await S.validateMatch(admin, q1.id);
  t = await T();
  assert.equal(t.matchByCode.get('QF1').winner_id, q1.away_id);
  await play(admin, t.matchByCode.get('QF2'), 2, 0);
  await play(admin, t.matchByCode.get('QF3'), 0, 1);
  t = await T();
  assert.deepEqual([t.matchByCode.get('DF1').home_id, t.matchByCode.get('DF1').away_id], [q1.away_id, t.matchByCode.get('QF3').away_id]);
  assert.equal(t.matchByCode.get('DF2').away_id, null, 'DF2 attend le QF4');
  await play(admin, t.matchByCode.get('QF4'), 3, 1);
  t = await T();
  const d1 = t.matchByCode.get('DF1');
  const d2 = t.matchByCode.get('DF2');
  assert.deepEqual([d2.home_id, d2.away_id], [t.matchByCode.get('QF2').home_id, t.matchByCode.get('QF4').home_id]);
  await play(admin, d1, 1, 0);
  await play(admin, d2, 0, 2);
  t = await T();
  const f = t.matchByCode.get('F');
  const p3 = t.matchByCode.get('3P');
  assert.deepEqual([f.home_id, f.away_id], [d1.home_id, d2.away_id]);
  assert.deepEqual([p3.home_id, p3.away_id], [d1.away_id, d2.home_id]);
  assert.equal(tournamentStatus(t), 'live');
  await play(admin, p3, 1, 0);
  await play(admin, f, 2, 1);
  t = await T();
  assert.equal(tournamentStatus(t), 'finished');
  assert.equal(t.matchByCode.get('F').winner_id, d1.home_id);
  assert.equal(tournamentStats(t).played, 32);
  const top = ranking(playerStats(t), 'goals');
  assert.ok(top.length > 0 && top[0].rank === 1);
});

test('démo : effacer les résultats fictifs, régénérer', async () => {
  await assert.rejects(() => S.regenerateDemo(admin), /non autorisée/);
  await S.regenerateDemo(boss);
  let t = await T();
  assert.equal(t.matches.filter((m) => m.official).length, 10);
  assert.equal(t.settings.demo, '1');
  await S.clearDemoResults(admin);
  t = await T();
  assert.equal(t.matches.filter((m) => m.status !== 'scheduled').length, 0);
  assert.equal(t.teams.length, 16);
  assert.equal(t.players.length, 208);
  assert.equal(tournamentStatus(t), 'upcoming');
  assert.equal(t.settings.demo, '0');
  // remplacement par les vraies données
  await S.saveTeam(admin, { id: 1, name: 'FC Réel', short: 'fcr', grp: 'A', coach: 'Coach', color: '#123456' });
  const pid = await S.savePlayer(admin, { team_id: 1, first_name: "N'Golo", last_name: "O'Brien", number: 14, position: 'M' });
  t = await T();
  assert.equal(t.teamById.get(1).short, 'FCR');
  assert.equal(t.playerById.get(pid).last_name, "O'Brien");
  await S.deletePlayer(admin, pid);
  await S.saveSettings(admin, { name: 'Ultras Tournoi 2026', tiebreakers: 'points,fairplay' });
  t = await T();
  assert.equal(t.settings.name, 'Ultras Tournoi 2026');
  assert.deepEqual(t.tiebreakers, ['points', 'fairplay', 'diff', 'goals', 'h2h']);
});

test('migration : une base en démo passe sur les vraies équipes', async () => {
  delete process.env.SEED_DEMO;
  await adapter.exec("UPDATE settings SET value = '1' WHERE key = 'demo'; DELETE FROM settings WHERE key = 'data_version';");
  S.invalidate();
  const { exec } = await import('../lib/db.js');
  // relance l'initialisation comme au démarrage d'une nouvelle instance
  const mod = await import('../lib/store.js?again');
  const t = await mod.loadTournament({ fresh: true });
  assert.equal(t.teams[0].name, 'Sunrise Team');
  assert.equal(t.settings.demo, '0');
  assert.equal(t.settings.data_version, '3');
  assert.equal(t.matches.length, 32);
  assert.equal(t.matches.filter((m) => m.status !== 'scheduled').length, 0);
  assert.equal((await S.listUsers(boss)).length, 3, 'comptes conservés');
  // régénération du calendrier après changement de groupe
  await S.saveTeam(admin, { id: 1, name: 'Sunrise Team', short: 'SUN', grp: 'B', color: '#C2410C' });
  await assert.rejects(() => S.rebuildSchedule(admin), /exactement 4/);
  await S.saveTeam(admin, { id: 2, name: 'Taste Life', short: 'TL', grp: 'A', color: '#047857' });
  await S.saveSettings(admin, { slots: 'xx', start_date: '2026-11-16' }).catch((e) => assert.match(e.message, /créneau/));
  await S.rebuildSchedule(admin);
  const t2 = await mod.loadTournament({ fresh: true });
  assert.equal(t2.matchByCode.get('A1').home_id, 2);
  assert.equal(t2.matches.length, 32);
});

test('v3 : Aigle et Z Team remplacent les places vides, capitaines', async () => {
  // base en v2 : « Équipe 10 » et « Équipe 11 » vides
  await adapter.exec("UPDATE settings SET value = '2' WHERE key = 'data_version'; UPDATE teams SET name = 'Équipe 10', short = 'E10' WHERE id = 10; UPDATE teams SET name = 'Équipe 11', short = 'E11' WHERE id = 11; DELETE FROM players WHERE team_id IN (10, 11); UPDATE players SET is_captain = FALSE;");
  const { exec } = await import('../lib/db.js');
  const { v3Script } = await import('../lib/seed.js');
  await exec(v3Script());
  await exec(v3Script()); // idempotent
  S.invalidate();
  let t = await S.loadTournament({ fresh: true });
  const aigle = t.teamById.get(10);
  const z = t.teamById.get(11);
  assert.equal(aigle.name, 'Aigle');
  assert.equal(z.name, 'Z Team');
  assert.equal(t.players.filter((p) => p.team_id === 10).length, 13);
  assert.equal(t.players.filter((p) => p.team_id === 11).length, 11);
  assert.ok(t.players.some((p) => p.team_id === 11 && p.last_name === 'Matta' && p.position === 'G'));
  const gmk = t.teams.find((x) => x.short === 'GMK');
  const firstGmk = t.players.find((p) => p.team_id === gmk.id);
  assert.equal(firstGmk.last_name, 'Akkash');
  assert.ok(firstGmk.is_captain, 'capitaine en premier dans la liste');
  assert.equal(t.settings.data_version, '3');
  // un seul capitaine par équipe
  const zp = t.players.filter((p) => p.team_id === 11);
  await S.savePlayer(admin, { ...zp[3], is_captain: '1' });
  await S.savePlayer(admin, { ...zp[5], is_captain: '1' });
  t = await S.loadTournament({ fresh: true });
  const caps = t.players.filter((p) => p.team_id === 11 && p.is_captain);
  assert.equal(caps.length, 1);
  assert.equal(caps[0].id, zp[5].id);
  assert.equal(t.players.find((p) => p.team_id === 11).id, zp[5].id);
  // une équipe déjà modifiée par l'organisateur n'est pas écrasée
  await adapter.exec("UPDATE settings SET value = '2' WHERE key = 'data_version'; UPDATE teams SET name = 'Équipe 10' WHERE id = 10;");
  await exec(v3Script());
  t = await S.loadTournament({ fresh: true });
  assert.equal(t.players.filter((p) => p.team_id === 10).length, 13, 'pas de doublon');
});
