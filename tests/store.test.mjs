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
  assert.equal(t.settings.data_version, '11');
  assert.equal(t.matches.length, 33);
  assert.equal(t.matches.filter((m) => m.status !== 'scheduled').length, 0);
  assert.equal((await S.listUsers(boss)).length, 3, 'comptes conservés');
  // changement de groupe : le programme officiel ne s'applique plus, calendrier automatique
  await S.saveTeam(admin, { id: 1, name: 'Sunrise Team', short: 'SUN', grp: 'D', color: '#C2410C' });
  await assert.rejects(() => S.rebuildSchedule(admin), /au moins 3/);
  await S.saveTeam(admin, { id: 1, name: 'Sunrise Team', short: 'SUN', grp: 'B', color: '#C2410C' });
  await S.saveSettings(admin, { slots: 'xx', start_date: '2026-11-16' }).catch((e) => assert.match(e.message, /créneau/));
  assert.equal(await S.rebuildSchedule(admin), 15 + 21 + 7);
  // retour aux groupes officiels : le programme officiel est remis en place
  await S.saveTeam(admin, { id: 1, name: 'Sunrise Team', short: 'SUN', grp: 'A', color: '#C2410C' });
  assert.equal(await S.rebuildSchedule(admin), 33);
  const t2 = await mod.loadTournament({ fresh: true });
  assert.equal(t2.matches.length, 33);
  assert.equal(t2.matches[0].kickoff, '2026-11-16T20:00');
  assert.equal(`${t2.matches[0].home.short}-${t2.matches[0].away.short}`, 'PAN-SMC');
});

test('v3 : Les Aigles et Z Team remplacent les places vides, capitaines', async () => {
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
  assert.equal(aigle.name, 'Les Aigles');
  assert.equal(z.name, 'Z Team');
  assert.equal(t.players.filter((p) => p.team_id === 10).length, 13);
  assert.equal(t.players.filter((p) => p.team_id === 11).length, 13);
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

test('v4 : capitaines de toutes les équipes, effectif EST', async () => {
  await adapter.exec("UPDATE settings SET value = '3' WHERE key = 'data_version'; UPDATE players SET is_captain = FALSE; UPDATE teams SET name = 'Le Centre', short = 'LC' WHERE short = 'U18';");
  await adapter.exec("INSERT INTO players (team_id, last_name) SELECT id, 'Dida' FROM teams WHERE short = 'EST' AND NOT EXISTS (SELECT 1 FROM players p WHERE p.last_name = 'Dida'); DELETE FROM players WHERE last_name = 'Derouich';");
  const { exec } = await import('../lib/db.js');
  const { v4Script } = await import('../lib/seed.js');
  await exec(v4Script());
  await exec(v4Script());
  S.invalidate();
  const t = await S.loadTournament({ fresh: true });
  const caps = Object.fromEntries(t.players.filter((p) => p.is_captain).map((p) => [t.teamById.get(p.team_id).short, `${p.first_name || ''} ${p.last_name}`.trim()]));
  assert.deepEqual(caps, { SUN: 'Mahdi Al Shab', TL: 'Abo Hamoud', SG: 'Yahye (Yaaya)', GMK: 'Mahdi Akkash', LC: 'Ali Bourgi', PAN: 'Michael', SMC: 'Mohamed Hamam', NSA: 'Ali Farhat', EST: 'Seifedine Hedhli', AIG: 'Abdalah Ach', ZT: 'Hussein' });
  const est = t.teams.find((x) => x.short === 'EST');
  const squad = t.players.filter((p) => p.team_id === est.id);
  assert.equal(squad.length, 13);
  assert.ok(!squad.some((p) => p.last_name === 'Dida'));
  assert.equal(squad.filter((p) => p.last_name === 'Derouich').length, 1);
  assert.equal(squad.find((p) => p.last_name === 'Sayed Fathy').position, 'G');
  assert.equal(squad[0].last_name, 'Hedhli', 'capitaine en tête');
  assert.equal(t.settings.data_version, '4');
});

test('v5 : Bokutani remplace Équipe 12', async () => {
  await adapter.exec("UPDATE settings SET value = '4' WHERE key = 'data_version'; DELETE FROM players WHERE team_id = 12; UPDATE teams SET name = 'Équipe 12', short = 'E12' WHERE id = 12;");
  const { exec } = await import('../lib/db.js');
  const { v5Script } = await import('../lib/seed.js');
  await exec(v5Script());
  await exec(v5Script());
  S.invalidate();
  const t = await S.loadTournament({ fresh: true });
  const b = t.teamById.get(12);
  assert.equal(b.name, 'Bokutani');
  const squad = t.players.filter((p) => p.team_id === 12);
  assert.equal(squad.length, 14);
  assert.equal(squad[0].last_name, 'Big');
  assert.ok(squad[0].is_captain);
  assert.equal(squad.filter((p) => p.is_captain).length, 1);
});

const OFFICIAL_A = 'AIG,EST,PAN,SG,SMC,SUN,ZT';
const OFFICIAL_B = 'BOK,GMK,NSA,TEQ,TL,U18';
const groupOf = (t, k) => t.teams.filter((x) => x.grp === k).map((x) => x.short).sort().join(',');
const squadOf = (t, short) => t.players.filter((p) => p.team_id === t.teams.find((x) => x.short === short).id);
const label = (p) => [p.first_name, p.last_name].filter(Boolean).join(' ');

test('v5 -> v7 : places vides supprimées, Tequila ajoutée, 2 groupes', async () => {
  // état « v5 » : 16 équipes dont 4 places vides, 4 groupes, pas de Tequila
  await adapter.exec(`UPDATE settings SET value = '5' WHERE key = 'data_version';
    DELETE FROM teams WHERE short = 'TEQ';
    UPDATE teams SET name = 'Aigle' WHERE short = 'AIG';
    INSERT INTO teams (name, short, grp, color) VALUES ('Équipe 13', 'E13', 'A', '#555'), ('Équipe 14', 'E14', 'B', '#555'), ('Équipe 15', 'E15', 'C', '#555'), ('Équipe 16', 'E16', 'D', '#555');
    UPDATE teams SET grp = 'D' WHERE short IN ('GMK', 'NSA', 'BOK');`);
  const mod = await import('../lib/store.js?v5to7');
  let t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  assert.equal(t.teams.length, 13);
  assert.ok(!t.teams.some((x) => x.name.startsWith('Équipe ')));
  assert.equal(groupOf(t, 'A'), OFFICIAL_A);
  assert.equal(groupOf(t, 'B'), OFFICIAL_B);
  assert.equal(groupOf(t, 'C') + groupOf(t, 'D'), '');
  assert.equal(t.teams.find((x) => x.short === 'AIG').name, 'Les Aigles');
  assert.equal(squadOf(t, 'TEQ').length, 14);
  assert.equal(t.matches.length, 33);
  // migration rejouée : rien ne bouge
  await adapter.exec("UPDATE settings SET value = '5' WHERE key = 'data_version';");
  const mod2 = await import('../lib/store.js?v5to7b');
  t = await mod2.loadTournament({ fresh: true });
  assert.equal(t.teams.length, 13);
  assert.equal(t.players.length, 164);
  assert.equal(t.matches.length, 33);
});

// Remet la base dans l'état « v6 » (3 groupes, anciens noms et effectifs, 31 matchs).
async function backToV6() {
  await adapter.exec(`UPDATE settings SET value = '6' WHERE key = 'data_version';
    UPDATE settings SET value = '1-20:00,1-22:00,2-20:00,3-22:00,6-22:00' WHERE key = 'slots';
    UPDATE teams SET name = 'Le Centre', short = 'LC' WHERE short = 'U18';
    UPDATE teams SET name = 'Aigle' WHERE short = 'AIG';
    UPDATE teams SET name = 'Taste Life' WHERE short = 'TL';
    UPDATE teams SET name = 'Star Group' WHERE short = 'SG';
    UPDATE teams SET name = 'Espérance de Tunis' WHERE short = 'EST';
    UPDATE teams SET grp = 'A' WHERE short IN ('NSA', 'PAN', 'SG', 'EST', 'TEQ');
    UPDATE teams SET grp = 'B' WHERE short IN ('SMC', 'GMK', 'TL', 'SUN');
    UPDATE teams SET grp = 'C' WHERE short IN ('AIG', 'ZT', 'LC', 'BOK');
    DELETE FROM players WHERE last_name IN ('Sabra', 'Yan', 'Alvin', 'Josee');
    UPDATE players SET first_name = 'JK', last_name = 'Hernandez' WHERE last_name = 'Jk';
    UPDATE players SET last_name = 'NS' WHERE last_name IN ('NS 17', 'Ns');
    UPDATE players SET first_name = 'Kabongo', last_name = 'Tshilumba' WHERE last_name = 'Kabongo Tshilumba Gabriel (KBG)';
    INSERT INTO players (team_id, first_name, last_name, position) SELECT id, NULL, 'Gabriel', 'G' FROM teams WHERE short = 'SG';
    INSERT INTO players (team_id, first_name, last_name) SELECT id, NULL, 'Merlin' FROM teams WHERE short = 'LC';
    INSERT INTO players (team_id, first_name, last_name) SELECT id, NULL, 'Bastien' FROM teams WHERE short = 'LC';
    INSERT INTO players (team_id, first_name, last_name) SELECT id, 'Alvine', 'Hernandez' FROM teams WHERE short = 'LC';
    TRUNCATE lineups, events, matches RESTART IDENTITY CASCADE;
    INSERT INTO matches (phase, grp, round, code, kickoff, venue, home_id, away_id)
      SELECT 'group', 'A', 1, 'A' || g, '2026-11-16T20:00', 'Terrain Ultras', (SELECT id FROM teams WHERE short = 'NSA'), (SELECT id FROM teams WHERE short = 'PAN') FROM generate_series(1, 22) g;
    INSERT INTO matches (phase, code, kickoff, home_src, away_src) SELECT 'qf', 'X' || g, '2026-12-20T20:00', '1A', '3*1' FROM generate_series(1, 9) g;`);
  S.invalidate();
}

test('v6 -> v7 : base en ligne (3 groupes) vers le programme officiel', async () => {
  await backToV6();
  // modifications faites à la main par les organisateurs avant la mise à jour
  const lc = (await adapter.q("SELECT id FROM teams WHERE short = 'LC'"))[0].id;
  await adapter.exec(`INSERT INTO players (team_id, first_name, last_name, number) VALUES (${lc}, 'Joueur', 'Ajouté', 99);
    UPDATE players SET number = 10 WHERE last_name = 'Bourgi' AND first_name = 'Ali';`);
  const before = await adapter.q('SELECT count(*)::int AS n FROM players');
  assert.equal(before[0].n, 164 - 4 + 3 + 1 + 1);
  const mod = await import('../lib/store.js?v6to7');
  let t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  assert.equal(t.teams.find((x) => x.short === 'U18').name, 'U18');
  assert.equal(t.settings.slots, '1-20:00,1-22:00,2-20:00,3-20:00,3-22:00,6-22:00');
  assert.equal(t.teams.length, 13);
  assert.equal(groupOf(t, 'A'), OFFICIAL_A);
  assert.equal(groupOf(t, 'B'), OFFICIAL_B);
  assert.equal(groupOf(t, 'C'), '');
  assert.deepEqual(['AIG', 'TL', 'SG', 'EST'].map((k) => t.teams.find((x) => x.short === k).name), ['Les Aigles', 'Tasty Life', 'Star Group (SG)', 'Espérance de Tunis (EST)']);
  // effectifs du 14 novembre, sans toucher aux ajouts des organisateurs
  assert.deepEqual(squadOf(t, 'U18').map(label).sort(), ['Adel Karim', 'Ahmad Bourgi', 'Ali Bourgi', 'Bobo', 'Hassan Attie', 'Iyad Achour', 'Jad Achour', 'Jk', 'Joueur Ajouté', 'Mahdi Sabra', 'Mardoche Liwanga', 'Yan']);
  assert.equal(squadOf(t, 'U18').find((p) => p.last_name === 'Bourgi' && p.first_name === 'Ali').number, 10);
  assert.ok(squadOf(t, 'U18')[0].is_captain);
  assert.equal(squadOf(t, 'ZT').length, 13);
  assert.ok(['Alvin', 'Anthony NS 17', 'Alex Ns'].every((n) => squadOf(t, 'ZT').some((p) => label(p) === n)));
  assert.equal(squadOf(t, 'SG').length, 10);
  assert.ok(squadOf(t, 'SG').some((p) => label(p) === 'Kabongo Tshilumba Gabriel (KBG)'));
  assert.ok(!squadOf(t, 'SG').some((p) => p.last_name === 'Gabriel'));
  assert.equal(squadOf(t, 'SUN').length, 13);
  assert.equal(t.players.length, 165);
  for (const tm of t.teams) assert.equal(t.players.filter((p) => p.team_id === tm.id && p.is_captain).length, 1, tm.name);
  // programme officiel
  assert.equal(t.matches.length, 33);
  assert.equal(t.matches.filter((m) => m.phase === 'group').length, 26);
  const show = (m) => `${m.kickoff} ${m.home.short}-${m.away.short}`;
  assert.deepEqual(t.matches.slice(0, 6).map(show), ['2026-11-16T20:00 PAN-SMC', '2026-11-16T22:00 NSA-TEQ', '2026-11-17T20:00 BOK-GMK', '2026-11-18T20:00 ZT-EST', '2026-11-18T22:00 SG-SUN', '2026-11-21T22:00 U18-NSA']);
  assert.equal(show(t.matches[25]), '2026-12-14T22:00 BOK-TL');
  assert.deepEqual(t.matches.slice(26).map((m) => `${m.kickoff} ${m.code} ${m.home_src}/${m.away_src}`), [
    '2026-12-15T20:00 QF1 1A/4B', '2026-12-16T20:00 QF2 2A/3B', '2026-12-16T22:00 QF3 1B/4A', '2026-12-19T22:00 QF4 2B/3A',
    '2026-12-21T20:00 DF1 W:QF1/W:QF3', '2026-12-23T20:00 DF2 W:QF2/W:QF4', '2026-12-26T22:00 F W:DF1/W:DF2',
  ]);
  assert.equal((await S.listUsers(boss)).length, 3, 'comptes conservés');
  // migration rejouée : aucun doublon
  await adapter.exec("UPDATE settings SET value = '6' WHERE key = 'data_version';");
  const mod2 = await import('../lib/store.js?v6to7b');
  t = await mod2.loadTournament({ fresh: true });
  assert.equal(t.players.length, 165);
  assert.equal(t.matches.length, 33);
  await adapter.exec("DELETE FROM players WHERE last_name = 'Ajouté';");
});

test('v6 -> v7 : un match déjà commencé protège le calendrier, abréviation rétablie', async () => {
  await backToV6();
  await adapter.exec("UPDATE matches SET status = 'live', period = '1H' WHERE id = 1; UPDATE teams SET short = 'TAS' WHERE short = 'TL';");
  const mod = await import('../lib/store.js?v6to7c');
  let t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  assert.equal(t.matches.length, 31, 'calendrier laissé tel quel');
  assert.equal(t.matchById.get(1).status, 'live');
  assert.equal(groupOf(t, 'B'), OFFICIAL_B, 'abréviation TL rétablie à partir du nom');
  assert.equal(squadOf(t, 'U18').length, 11);
  await assert.rejects(() => S.rebuildSchedule(admin), /déjà commencé/);
  // une fois le match remis à zéro, l'administrateur peut remettre le programme officiel
  await S.resetMatch(admin, 1);
  assert.equal(await S.rebuildSchedule(admin), 33);
  t = await S.loadTournament({ fresh: true });
  assert.equal(t.players.length, 164);
});

test('format à 2 groupes : tournoi complet jusqu\'à la finale', async () => {
  const E = await import('../lib/engine.js');
  let t = await S.loadTournament({ fresh: true });
  assert.equal(E.directSpots(t), 4);
  assert.equal(E.qualifiedTeams(t).length, 0);
  const strength = (id) => (id * 7) % 11; // force arbitraire et fixe
  const groupMatches = t.matches.filter((x) => x.phase === 'group');
  assert.equal(groupMatches.length, 26);
  for (const m of groupMatches) {
    const hs = Math.max(0, Math.round(strength(m.home_id) / 3) - (m.id % 2));
    const as = Math.max(0, Math.round(strength(m.away_id) / 3) - ((m.id + 1) % 2));
    await S.startMatch(admin, m.id);
    for (let i = 0; i < hs; i++) await S.addEvent(admin, { match_id: m.id, team_id: m.home_id, type: 'goal', minute: 10 + i });
    for (let i = 0; i < as; i++) await S.addEvent(admin, { match_id: m.id, team_id: m.away_id, type: 'goal', minute: 30 + i });
    await S.finishMatch(admin, m.id);
    if (m.id === 25) {
      // tant que le groupe A n'est pas entièrement validé, les quarts restent vides
      const mid = await S.loadTournament({ fresh: true });
      assert.equal(mid.matchByCode.get('QF1').home_id, null);
    }
    await S.validateMatch(admin, m.id);
  }
  t = await S.loadTournament({ fresh: true });
  assert.ok(E.allGroupsComplete(t));
  const st = { A: E.groupStandings(t, 'A'), B: E.groupStandings(t, 'B') };
  assert.equal(st.A.length, 7);
  assert.equal(st.B.length, 6);
  assert.ok([...st.A, ...st.B].every((r) => r.j === 4), 'chaque équipe a joué 4 matchs');
  const q = (c) => t.matchByCode.get(c);
  const pair = (c) => [q(c).home_id, q(c).away_id];
  assert.deepEqual(pair('QF1'), [st.A[0].team.id, st.B[3].team.id]);
  assert.deepEqual(pair('QF2'), [st.A[1].team.id, st.B[2].team.id]);
  assert.deepEqual(pair('QF3'), [st.B[0].team.id, st.A[3].team.id]);
  assert.deepEqual(pair('QF4'), [st.B[1].team.id, st.A[2].team.id]);
  const qualified = E.qualifiedTeams(t);
  assert.equal(qualified.length, 8);
  assert.equal(new Set(qualified.map((x) => x.team.id)).size, 8);
  assert.ok(!qualified.some((x) => [st.A[4], st.A[5], st.A[6], st.B[4], st.B[5]].some((r) => r.team.id === x.team.id)));
  // quarts : l'équipe à domicile gagne, sauf QF2 aux tirs au but
  for (const c of ['QF1', 'QF3', 'QF4']) {
    const m = q(c);
    await S.startMatch(admin, m.id);
    await S.addEvent(admin, { match_id: m.id, team_id: m.home_id, type: 'goal', minute: 5 });
    await S.finishMatch(admin, m.id);
    await S.validateMatch(admin, m.id);
  }
  const m2 = q('QF2');
  await S.startMatch(admin, m2.id);
  for (const p of ['HT', '2H', 'FT', 'ET1', 'ETB', 'ET2', 'PEN']) await S.setPeriod(admin, m2.id, p);
  await S.setPens(admin, m2.id, 2, 4);
  await S.finishMatch(admin, m2.id);
  await S.validateMatch(admin, m2.id);
  t = await S.loadTournament({ fresh: true });
  assert.deepEqual(pair('DF1'), [q('QF1').home_id, q('QF3').home_id]);
  assert.deepEqual(pair('DF2'), [q('QF2').away_id, q('QF4').home_id]);
  assert.ok(!t.matches.some((m) => m.phase === 'third' || m.phase === 'fifth'), 'pas de match de classement');
  for (const c of ['DF1', 'DF2', 'F']) {
    const m = (await S.loadTournament({ fresh: true })).matchByCode.get(c);
    assert.ok(m.home_id && m.away_id, `${c} : équipes connues`);
    await S.startMatch(admin, m.id);
    await S.addEvent(admin, { match_id: m.id, team_id: m.away_id, type: 'goal', minute: 5 });
    await S.finishMatch(admin, m.id);
    await S.validateMatch(admin, m.id);
  }
  t = await S.loadTournament({ fresh: true });
  assert.equal(E.tournamentStatus(t), 'finished');
  assert.equal(E.tournamentStats(t).played, 33);
  assert.equal(t.matchByCode.get('F').winner_id, t.matchByCode.get('DF2').winner_id);
});

test('v7 -> v8 : Le Centre devient U18 sans toucher au calendrier ni aux résultats', async () => {
  // état « v7 » : base en ligne actuelle, avec un match déjà joué
  await S.rebuildSchedule(admin).catch(() => {});
  await adapter.exec("UPDATE teams SET name = 'Le Centre', short = 'LC' WHERE short = 'U18'; UPDATE settings SET value = '7' WHERE key = 'data_version'; UPDATE matches SET status = 'finished', validated = true WHERE id = 6;");
  S.invalidate();
  const before = await adapter.q('SELECT id, home_id, away_id, kickoff, status FROM matches ORDER BY id');
  const mod = await import('../lib/store.js?v7to8');
  const t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  const u18 = t.teams.find((x) => x.short === 'U18');
  assert.equal(u18.name, 'U18');
  assert.ok(!t.teams.some((x) => x.short === 'LC' || x.name === 'Le Centre'));
  assert.equal(t.players.filter((p) => p.team_id === u18.id).length, 11);
  assert.deepEqual(await adapter.q('SELECT id, home_id, away_id, kickoff, status FROM matches ORDER BY id'), before);
  assert.equal(t.matchById.get(6).home.name, 'U18');
  assert.equal(t.matchById.get(6).status, 'finished');
});

test('v9 : U18 retrouve le groupe B après le passage d\'un ancien déploiement, base plus récente intouchée', async () => {
  // ce qu'a laissé l'ancien code v7 en voyant une base v8 : U18 sans groupe, version remise à 7
  await adapter.exec("UPDATE teams SET grp = NULL WHERE short = 'U18'; UPDATE settings SET value = '7' WHERE key = 'data_version';");
  const before = await adapter.q('SELECT id, home_id, away_id, kickoff, status FROM matches ORDER BY id');
  const mod = await import('../lib/store.js?v9');
  let t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  assert.equal(groupOf(t, 'B'), OFFICIAL_B);
  assert.equal(groupOf(t, 'A'), OFFICIAL_A);
  assert.deepEqual(await adapter.q('SELECT id, home_id, away_id, kickoff, status FROM matches ORDER BY id'), before);
  // une base d'une version plus récente n'est pas modifiée par ce code
  await adapter.exec("UPDATE teams SET grp = NULL WHERE short = 'U18'; UPDATE settings SET value = '12' WHERE key = 'data_version';");
  const mod2 = await import('../lib/store.js?v9b');
  t = await mod2.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '12');
  assert.equal(t.teams.find((x) => x.short === 'U18').grp, null);
});

test('v10 : Guelor (Z Team) est remplacé par Stephane', async () => {
  await adapter.exec("UPDATE players SET first_name = NULL, last_name = 'Guelor' WHERE last_name = 'Stephane'; UPDATE settings SET value = '9' WHERE key = 'data_version';");
  const mod = await import('../lib/store.js?v10');
  const t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  const zt = t.teams.find((x) => x.short === 'ZT');
  const names = t.players.filter((p) => p.team_id === zt.id).map((p) => p.last_name);
  assert.ok(names.includes('Stephane'));
  assert.ok(!names.includes('Guelor'));
});

test('v11 : Samuel rejoint Z Team', async () => {
  await adapter.exec("DELETE FROM players WHERE last_name = 'Samuel' OR first_name = 'Samuel'; UPDATE settings SET value = '10' WHERE key = 'data_version';");
  const mod = await import('../lib/store.js?v11');
  const t = await mod.loadTournament({ fresh: true });
  assert.equal(t.settings.data_version, '11');
  const zt = t.teams.find((x) => x.short === 'ZT');
  const names = t.players.filter((p) => p.team_id === zt.id).map((p) => [p.first_name, p.last_name].filter(Boolean).join(' '));
  assert.equal(names.filter((n) => n === 'Samuel').length, 1);
});
